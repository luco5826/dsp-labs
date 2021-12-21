"use strict";

const Task = require("../components/task");
const User = require("../components/user");
const db = require("../components/db");
var WSMessage = require("../components/ws_message.js");
var WebSocket = require("../components/websocket");
const { recurringQueries } = require("./utils");

/**
 * Assign a user to the task
 *
 *
 * Input:
 * - userId : ID of the task assignee
 * - taskId: ID of the task to be assigned
 * - owner: ID of the user who wants to assign the task
 * Output:
 * - no response expected for this operation
 *
 **/
exports.assignTaskToUser = function (userId, taskId, owner) {
  return new Promise((resolve, reject) => {
    db.all(recurringQueries.GET_OWNER_BY_TASK_ID, [taskId], (error, rows) => {
      if (error) return reject(error);
      if (rows.length === 0) return reject(404);
      if (owner != rows[0].owner) return reject(403);

      const insertStmt = "INSERT INTO assignments(task, user) VALUES(?,?)";
      db.run(insertStmt, [taskId, userId], (error) => {
        if (error) return reject(error);

        resolve(null);
      });
    });
  });
};

/**
 * Retreve the users assignted to the task
 *
 * Input:
 * - taskId: ID of the task
 * - owner: ID of the user who wants to retrieve the list of assignees
 * Output:
 * - list of assignees
 *
 **/
exports.getUsersAssigned = function (taskId, owner) {
  return new Promise((resolve, reject) => {
    db.all(recurringQueries.GET_OWNER_BY_TASK_ID, [taskId], (err, rows) => {
      if (err) return reject(err);
      if (rows.length === 0) return reject(404);
      if (owner != rows[0].owner) return reject(403);

      const sql2 = `
        SELECT u.id as uid, u.name, u.email 
        FROM assignments as a, users as u 
        WHERE  a.task = ? 
        AND a.user = u.id`;

      db.all(sql2, [taskId], (err, rows) => {
        if (err) return reject(err);

        resolve(
          rows.map((row) => new User(row.uid, row.name, row.email, null))
        );
      });
    });
  });
};

/**
 * Remove a user from the assigned task
 *
 * Input:
 * - taskId: ID of the task
 * - userId: ID of the assignee
 * - owner : ID of user who wants to remove the assignee
 * Output:
 * - no response expected for this operation
 *
 **/
exports.removeUser = function (taskId, userId, owner) {
  return new Promise((resolve, reject) => {
    db.all(recurringQueries.GET_OWNER_BY_TASK_ID, [taskId], (err, rows) => {
      if (err) return reject(err);
      if (rows.length === 0) return reject(404);
      if (owner != rows[0].owner) return reject(403);

      const sql2 = "DELETE FROM assignments WHERE task = ? AND user = ?";
      db.run(sql2, [taskId, userId], (err) => {
        if (err) return reject(err);

        resolve(null);
      });
    });
  });
};

/**
 * Reassign tasks in a balanced manner
 *
 * Input:
 * - owner : ID of user who wants to assign the tasks
 * Output:
 * - no response expected for this operation
 *
 **/
exports.assignBalanced = function (owner) {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT t1.id FROM tasks t1 LEFT JOIN assignments t2 ON t2.task = t1.id WHERE t1.owner = ? AND t2.task IS NULL";
    db.each(sql, [owner], (err, tasks) => {
      if (err) return reject(err);

      exports.assignEach(tasks.id, owner).then((userid) => resolve(userid));
    });
  });
};

/**
 * Select a task as the active task
 *
 * Input:
 * - userId: id of the user who wants to select the task
 * - taskId: ID of the task to be selected
 * Output:
 * - no response expected for this operation
 *
 **/
exports.selectTask = function selectTask(userId, taskId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION;");
      const sql1 = `
            SELECT u.name, t.description 
            FROM assignments as a, users as u, tasks as t 
            WHERE a.user = ? 
            AND a.task = ? 
            AND a.user = u.id 
            AND a.task = t.id`;
      db.all(sql1, [userId, taskId], function (err, rows) {
        if (err) {
          db.run("ROLLBACK;");
          reject(err);
        } else {
          const sql2 = "UPDATE assignments SET active = 0 WHERE user = ?";
          db.run(sql2, [userId], function (err) {
            if (err) {
              db.run("ROLLBACK;");
              reject(err);
            } else {
              const sql3 =
                "UPDATE assignments SET active = 1 WHERE user = ? AND task = ?";
              db.run(sql3, [userId, taskId], function (err) {
                if (err) {
                  db.run("ROLLBACK;");
                  reject(err);
                } else if (this.changes == 0) {
                  db.run("ROLLBACK;");
                  reject(403);
                } else {
                  db.run("COMMIT TRANSACTION");
                  //inform the clients that the user selected a different task where they are working on
                  const updateMessage = new WSMessage(
                    "update",
                    Number.parseInt(userId),
                    rows[0].name,
                    Number.parseInt(taskId),
                    rows[0].description
                  );
                  WebSocket.sendAllClients(updateMessage);
                  WebSocket.saveMessage(
                    userId,
                    new WSMessage(
                      "login",
                      Number.parseInt(userId),
                      rows[0].name,
                      Number.parseInt(taskId),
                      rows[0].description
                    )
                  );

                  resolve();
                }
              });
            }
          });
        }
      });
    });
  });
};

/**
 * Utility functions
 */
exports.assignEach = function (taskId, owner) {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT user, MIN(Count) as MinVal FROM (SELECT user,COUNT(*) as Count FROM assignments GROUP BY user) T";
    db.get(sql, (err, user) => {
      if (err) reject(err);
      exports
        .assignTaskToUser(user.user, taskId, owner)
        .then(() => resolve(user.user));
    });
  });
};
