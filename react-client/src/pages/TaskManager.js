import { useEffect, useState } from "react";
import { Button, Col } from "react-bootstrap";
import { useHistory, useParams } from "react-router";
import API from "../API";
import ContentList from "../components/ContentList";
import Filters from "../components/Filters";
import MiniOnlineList from "../components/MiniOnlineList";
import ModalForm from "../components/ModalForm";

const filters = {
  owned: { label: "Owned Tasks", id: "owned" },
  assigned: { label: "Assigned Tasks", id: "assigned" },
  public: { label: "Public Tasks", id: "public" },
};

const TaskManager = ({ onCheck, onlineList }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(undefined);
  const [pageInfo, setPageInfo] = useState({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
  });
  const [refetchTasks, setRefetchTasks] = useState(false);

  const history = useHistory();
  const { filter } = useParams();

  useEffect(() => onPageChange(filter, 1), [filter]);

  useEffect(() => {
    if (refetchTasks) {
      API.getTasks(filter).then((payload) => {
        setTasks(payload.tasks);
        setPageInfo(payload.pageInfo);
        setRefetchTasks(false);
      });
    }
    // eslint-disable-next-line
  }, [refetchTasks]);

  const onPageChange = (filter, page) => {
    API.getTasks(filter, page).then((payload) => {
      setTasks(payload.tasks);
      setPageInfo(payload.pageInfo);
    });
  };

  const onTaskDelete = (task) => {
    API.deleteTask(task)
      .then(() => setRefetchTasks(true))
      .catch((e) => console.log(e));
  };

  const onTaskComplete = (task) => {
    API.completeTask(task)
      .then(() => setRefetchTasks(true))
      .catch((e) => console.log(e));
  };
  const onTaskEdit = (task) => {
    setSelectedTask(task);
  };

  const onTaskCheck = (task) => {
    API.selectTask(task)
      .then(() => setRefetchTasks(true))
      .catch((e) => console.log(e));
  };
  const onSaveOrUpdate = (task) => {
    // if the task has an id it is an update
    if (task.id) {
      API.updateTask(task).then((response) => {
        if (response.ok) {
          API.getTasks(filter, pageInfo.currentPage).then((payload) => {
            setTasks(payload.tasks);
            setPageInfo(payload.pageInfo);
          });
        }
      });

      // otherwise it is a new task to add
    } else {
      API.addTask(task).then(() => setRefetchTasks(true));
    }
    setSelectedTask(undefined);
  };

  const onFilterSelect = (filter) => history.push("/list/" + filter);

  return (
    <>
      {/* Available filters sidebar */}
      <Col sm={3} id="left-sidebar">
        <Filters
          items={filters}
          defaultActiveKey={filter}
          onSelect={onFilterSelect}
        />
        <MiniOnlineList onlineList={onlineList} />
      </Col>
      <Col sm={9}>
        <h1>
          Filter: <span className="text-muted">{filter}</span>
        </h1>
        <ContentList
          tasks={tasks}
          pageInfo={pageInfo}
          onDelete={onTaskDelete}
          onEdit={onTaskEdit}
          onCheck={onTaskCheck}
          onComplete={onTaskComplete}
          filter={filter}
          onPageChange={onPageChange}
        />
      </Col>
      <Button
        variant="success"
        size="lg"
        className="fixed-right-bottom"
        onClick={() => setSelectedTask({})}
      >
        +
      </Button>

      {selectedTask !== undefined && (
        <ModalForm
          show={true}
          task={selectedTask}
          onSave={onSaveOrUpdate}
          onClose={() => setSelectedTask(undefined)}
        />
      )}
    </>
  );
};

export default TaskManager;
