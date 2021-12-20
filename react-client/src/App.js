import { React, useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
} from "react-router-dom";

import API from "./API";

import { Container, Row, Toast } from "react-bootstrap";

import Navigation from "./components/Navigation";
import { LoginForm } from "./components/Login";

import OnlineListManager from "./pages/OnlineListManager";
import TaskManager from "./pages/TaskManager";
import AssignmentsManager from "./pages/AssignmentsManager";

import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isTomorrow from "dayjs/plugin/isTomorrow";
import isYesterday from "dayjs/plugin/isYesterday";
dayjs.extend(isToday).extend(isTomorrow).extend(isYesterday);

const url = "ws://localhost:5000";
let ws = new WebSocket(url);

const App = () => {
  return (
    <Router>
      <Main />
    </Router>
  );
};
const Main = () => {
  const [onlineList, setOnlineList] = useState([]);

  const [message, setMessage] = useState("");

  const [loggedIn, setLoggedIn] = useState(false); // at the beginning, no user is logged in
  const [user, setUser] = useState(null);

  // active filter is read from the current url

  useEffect(() => {
    ws.onopen = () => {
      console.log("Connected to websocket");
    };
    ws.onclose = () => {
      console.log("Disconnected from websocket");
    };
    ws.onmessage = (message) => {
      const { typeMessage, userId, userName, taskId, taskName } = JSON.parse(
        message.data
      );
      console.log(JSON.parse(message.data));
      if (typeMessage === "login" || typeMessage === "update") {
        setOnlineList((list) => {
          return [
            ...list.filter((u) => u.userId !== userId),
            { userId, userName, taskId, taskName },
          ];
        });
      } else if (typeMessage === "logout") {
        setOnlineList((list) => list.filter((u) => u.userId !== userId));
      }
    };

    // check if user is authenticated
    API.getUserInfo().then((authenticated) => {
      if (authenticated) {
        setLoggedIn(true);
      } else {
        console.log("error");
      }
    });
  }, []);

  const doLogIn = async (credentials) => {
    try {
      const user = await API.logIn(credentials);

      setUser(user);
      setLoggedIn(true);
    } catch (err) {
      // error is handled and visualized in the login form, do not manage error, throw it
      throw err;
    }
  };

  const handleLogOut = async () => {
    await API.logOut();
    // clean up everything
    setLoggedIn(false);
    setUser(null);
    localStorage.removeItem("userId");
    localStorage.removeItem("email");
    localStorage.removeItem("username");
  };

  return (
    <Container fluid>
      <Row>
        <Navigation onLogOut={handleLogOut} loggedIn={loggedIn} user={user} />
      </Row>

      <Toast
        show={message !== ""}
        onClose={() => setMessage("")}
        delay={3000}
        autohide
      >
        <Toast.Body>{message?.msg}</Toast.Body>
      </Toast>

      <Switch>
        <Route path="/login">
          <Row>
            {loggedIn ? <Redirect to="/" /> : <LoginForm login={doLogIn} />}
          </Row>
        </Route>

        <Route path="/online">
          <Row>
            <OnlineListManager userList={onlineList} />
          </Row>
        </Route>

        <Route path="/assignment">
          {loggedIn ? (
            <Row>
              <AssignmentsManager onlineList={onlineList} />
            </Row>
          ) : (
            <Redirect to="/login" />
          )}{" "}
        </Route>

        <Route path={"/list/:filter"}>
          {loggedIn ? (
            <Row>
              <TaskManager onlineList={onlineList}></TaskManager>
            </Row>
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
        <Route>
          <Redirect to="/list/owned" />
        </Route>
      </Switch>
    </Container>
  );
};

export default App;
