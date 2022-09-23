import React, { useEffect, useReducer, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";

import LinearProgress from "@mui/material/LinearProgress";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";

import { requestAPI } from "./handler";

const SSE_CLOSED = 2;

const REPORT_TOUCH = 17;
const REPORT_DELTA = 18;
const REPORT_RAW = 19;
const REPORT_BASELINE = 20;
const REPORT_FPS = 120;

enum State {
  idle = "IDLE",
  selected = "SELECTED",
  collecting = "COLLECTING",
  collected_valid = "COLLECTED_VALID",
  collected_invalid = "COLLECTED_INVALID",
  uploading = "UPLOADING",
  uploaded = "UPLOADED"
}

type TransitionType = {
  [T: string]: State;
};

type StateType = {
  [key in State]: TransitionType;
};

const NEXT_STATE_GRAPH: StateType = {
  [State.idle]: {
    SELECT: State.selected
  },
  [State.selected]: {
    SELECT: State.selected,
    COLLECT: State.collecting
  },
  [State.collecting]: {
    STOP_VALID: State.collected_valid,
    STOP_INVALID: State.collected_invalid
  },
  [State.collected_valid]: {
    SELECT: State.selected,
    CANCEL: State.selected,
    UPLOAD: State.uploading
  },
  [State.collected_invalid]: {
    SELECT: State.selected,
    COLLECT: State.collecting
  },
  [State.uploading]: {
    UPLOADED: State.uploaded
  },
  [State.uploaded]: {
    SELECT: State.selected,
    DONE: State.selected
  }
};

const showHelp = false;

let eventSource: EventSource | undefined;
let eventData: any;

let collectedData: any[] = [];

const eventHandler = (event: any) => {
  const data = JSON.parse(event.data);
  if (!data || !data.report || data.report[0] !== "raw") {
    return;
  }
  eventData = data.report[1];
  collectedData.push(eventData);
};

const errorHandler = (error: any) => {
  console.error(`Error on GET /webds/report\n${error}`);
};

const removeEvent = () => {
  if (eventSource && eventSource.readyState !== SSE_CLOSED) {
    eventSource.removeEventListener("report", eventHandler, false);
    eventSource.removeEventListener("error", errorHandler, false);
    eventSource.close();
    eventSource = undefined;
  }
};

const addEvent = () => {
  if (eventSource) {
    return;
  }
  eventSource = new window.EventSource("/webds/report");
  eventSource.addEventListener("report", eventHandler, false);
  eventSource.addEventListener("error", errorHandler, false);
};

const setReport = async (
  disable: number[],
  enable: number[]
): Promise<void> => {
  const dataToSend = { enable, disable, fps: REPORT_FPS };
  try {
    await requestAPI<any>("report", {
      body: JSON.stringify(dataToSend),
      method: "POST"
    });
    collectedData = [];
    addEvent();
  } catch (error) {
    console.error("Error - POST /webds/report");
    return Promise.reject("Failed to enable/disable report types");
  }
  return Promise.resolve();
};

const reducer = (state: State, action: string) => {
  const nextState = NEXT_STATE_GRAPH[state][action];
  return nextState !== undefined ? nextState : state;
};

export const Landing = (props: any): JSX.Element => {
  const [state, dispatch] = useReducer(reducer, State.idle);
  const [test, setTest] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [listRightPdding, setListRightPadding] = useState(0);

  const handleCollectButtonClick = async () => {
    await setReport(
      [REPORT_TOUCH, REPORT_DELTA, REPORT_BASELINE],
      [REPORT_RAW]
    );
    dispatch("COLLECT");
  };

  const handleStopButtonClick = () => {
    removeEvent();
    if (collectedData.length > 0) {
      dispatch("STOP_VALID");
    } else {
      dispatch("STOP_INVALID");
    }
  };

  const handleCancelButtonClick = () => {
    dispatch("CANCEL");
  };

  const handleUploadButtonClick = () => {
    dispatch("UPLOAD");
    setTimeout(() => {
      dispatch("UPLOADED");
    }, 3000);
  };

  const handleDoneButtonClick = () => {
    dispatch("DONE");
  };

  const handleStepsViewButtonClick = () => {
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const handleDialogOkayButtonClick = () => {
    handleDialogClose();
  };

  const handleListItemClick = (item: any) => {
    if (state === State.collecting || state === State.uploading) {
      return;
    }
    if (test && test.id === item.id) {
      return;
    }
    setTest(item);
    dispatch("SELECT");
  };

  const generateMessage = (): JSX.Element => {
    let message: string;
    switch (state) {
      case State.idle:
        message = "Select Test Case";
        break;
      case State.selected:
        message = test.title;
        break;
      case State.collecting:
        message = "Collecting...";
        break;
      case State.collected_valid:
      case State.collected_invalid:
        if (collectedData.length > 1) {
          message = `${collectedData.length} Frames Collected`;
        } else {
          message = `${collectedData.length} Frame Collected`;
        }
        break;
      case State.uploading:
        message = "Uploading...";
        break;
      case State.uploaded:
        if (collectedData.length > 1) {
          message = `${collectedData.length} Frames Uploaded`;
        } else {
          message = `${collectedData.length} Frame Uploaded`;
        }
        break;
      default:
        message = "Select Test Case";
    }
    return <Typography>{message}</Typography>;
  };

  const generateListItems = (): JSX.Element[] => {
    return props.tests.map((item: any, index: number) => {
      const selected = test === null ? false : test.id === item.id;
      return (
        <div
          key={index}
          style={{
            position: "relative"
          }}
        >
          <ListItem divider>
            <ListItemButton
              selected={selected}
              onClick={() => handleListItemClick(item)}
              sx={{ padding: "0px 16px" }}
            >
              <ListItemText primary={item.title} />
            </ListItemButton>
          </ListItem>
          {selected &&
            (state === State.collecting || state === State.uploading) && (
              <LinearProgress
                sx={{
                  position: "absolute",
                  bottom: "0px",
                  width: "100%"
                }}
              />
            )}
        </div>
      );
    });
  };

  const generateControls = (): JSX.Element => {
    switch (state) {
      case State.idle:
      case State.selected:
      case State.collected_invalid:
        return (
          <Button
            disabled={state === State.idle}
            onClick={() => handleCollectButtonClick()}
            sx={{ width: "150px" }}
          >
            Collect
          </Button>
        );
      case State.collecting:
        return (
          <Button
            onClick={() => handleStopButtonClick()}
            sx={{ width: "150px" }}
          >
            Stop
          </Button>
        );
      case State.collected_valid:
      case State.uploading:
        return (
          <Stack spacing={2} direction="row">
            <Stack>
              <Button
                disabled={state === State.uploading}
                onClick={() => handleCancelButtonClick()}
                sx={{
                  width: "150px"
                }}
              >
                Cancel
              </Button>
            </Stack>
            <Stack>
              <Button
                disabled={state === State.uploading}
                onClick={() => handleUploadButtonClick()}
                sx={{
                  width: "150px"
                }}
              >
                Upload
              </Button>
            </Stack>
          </Stack>
        );
      case State.uploaded:
        return (
          <Button
            onClick={() => handleDoneButtonClick()}
            sx={{ width: "150px" }}
          >
            Done
          </Button>
        );
      default:
        return (
          <Button disabled sx={{ width: "150px" }}>
            Collect
          </Button>
        );
    }
  };

  const generateTestSteps = (): JSX.Element[] => {
    return test.custom_steps
      .match(/(\d+\.\s?)?(.*?)(\r\n|\r|\n|$)/g)
      .map((item: string, index: number) => {
        item = item.replace(/(\r\n|\r|\n)/gm, "").trim();
        if (item === "") {
          return null;
        }
        return (
          <ListItem key={index}>
            <ListItemText primary={item} />
          </ListItem>
        );
      });
  };

  useEffect(() => {
    const element = document.getElementById("webds_sandbox_test_list");
    if (element && element.scrollHeight > element.clientHeight) {
      setListRightPadding(8);
    } else {
      setListRightPadding(0);
    }
  }, [props.tests]);

  return (
    <>
      <Stack spacing={2}>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            height: props.dimensions.heightTitle + "px",
            position: "relative",
            bgcolor: "section.main"
          }}
        >
          <Typography
            variant="h5"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)"
            }}
          >
            Data Collection
          </Typography>
          {showHelp && (
            <Button
              variant="text"
              sx={{
                position: "absolute",
                top: "50%",
                left: "16px",
                transform: "translate(0%, -50%)"
              }}
            >
              <Typography variant="body2" sx={{ textDecoration: "underline" }}>
                Help
              </Typography>
            </Button>
          )}
        </Box>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            height: props.dimensions.heightContent + "px",
            boxSizing: "border-box",
            padding: "24px",
            position: "relative",
            bgcolor: "section.main",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            style={{
              margin: "0px auto 24px auto"
            }}
          >
            {generateMessage()}
          </div>
          <div
            id="webds_sandbox_test_list"
            style={{
              paddingRight: listRightPdding,
              overflow: "auto"
            }}
          >
            <List sx={{ padding: "0px" }}>{generateListItems()}</List>
          </div>
        </Box>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            minHeight: props.dimensions.heightControls + "px",
            boxSizing: "border-box",
            padding: "24px",
            position: "relative",
            bgcolor: "section.main",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {generateControls()}
          <Button
            variant="text"
            disabled={
              state === State.idle ||
              state === State.collecting ||
              state === State.uploading ||
              state === State.collected_invalid
            }
            onClick={() => handleStepsViewButtonClick()}
            sx={{
              position: "absolute",
              top: "50%",
              right: "24px",
              transform: "translate(0%, -50%)"
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color:
                  state === State.idle ||
                  state === State.collecting ||
                  state === State.uploading ||
                  state === State.collected_invalid
                    ? "colors.grey"
                    : props.service.ui.getJupyterFontColor(),
                textDecoration: "underline"
              }}
            >
              {state === State.idle ||
              state === State.selected ||
              state === State.collecting
                ? "Test Steps"
                : "View Last Frame"}
            </Typography>
          </Button>
        </Box>
      </Stack>
      {state !== State.idle && (
        <Dialog
          fullWidth
          maxWidth={
            state === State.selected || state === State.collecting ? "xs" : "md"
          }
          open={openDialog}
          onClose={handleDialogClose}
        >
          <DialogTitle sx={{ textAlign: "center" }}>{test.title}</DialogTitle>
          <DialogContent>
            {state === State.selected || state === State.collecting ? (
              <List dense>{generateTestSteps()}</List>
            ) : (
              collectedData.length > 0 && (
                <Typography variant="body2">
                  {JSON.stringify(collectedData[collectedData.length - 1])}
                </Typography>
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleDialogOkayButtonClick}
              sx={{ width: "100px" }}
            >
              Okay
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};
