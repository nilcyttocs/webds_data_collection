import React, { useContext, useEffect, useReducer, useState } from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemButton from "@mui/material/ListItemButton";

import SvgIcon from "@mui/material/SvgIcon";
import IconButton from "@mui/material/IconButton";

import LinearProgress from "@mui/material/LinearProgress";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import TextField from "@mui/material/TextField";

import {
  Page,
  RecordedDataContext,
  Report,
  testRailRequest
} from "./widget_container";

import { TestRailIcon } from "./testrail_logo";

import { requestAPI } from "./handler";

enum State {
  idle = "IDLE",
  selected = "SELECTED",
  collecting = "COLLECTING",
  collected_valid = "COLLECTED_VALID",
  collected_invalid = "COLLECTED_INVALID",
  uploading = "UPLOADING",
  uploaded = "UPLOADED",
  upload_failed = "UPLOAD_FAILED"
}

type TransitionType = {
  [T: string]: State;
};

type StateType = {
  [key in State]: TransitionType;
};

const nextStateGraph: StateType = {
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
    UPLOADED: State.uploaded,
    UPLOAD_FAILED: State.upload_failed
  },
  [State.uploaded]: {
    SELECT: State.selected,
    DONE: State.selected
  },
  [State.upload_failed]: {
    SELECT: State.selected,
    CANCEL: State.selected,
    UPLOAD: State.uploading
  }
};

const SSE_CLOSED = 2;

const REPORT_TOUCH = 17;
const REPORT_DELTA = 18;
const REPORT_RAW = 19;
const REPORT_BASELINE = 20;
const REPORT_FPS = 120;

const TESTRAIL_CASES_VIEW_URL =
  "https://synasdd.testrail.net/index.php?/cases/view/";

const DEFAULT_DATA_FILE_NAME = "collected_data.json";

const showHelp = false;

let eventSource: EventSource | undefined;
let eventData: any;

let collectedData: Report[] = [];

const initialState: State = State.idle;
const initialTestCase: any = null;
let stateStore: State = initialState;
let testCaseStore: any = initialTestCase;

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
  const nextState = nextStateGraph[state][action];
  return nextState !== undefined ? nextState : state;
};

export const Landing = (props: any): JSX.Element => {
  const [state, dispatch] = useReducer(reducer, stateStore);
  const [testCase, setTestCase] = useState<any>(testCaseStore);
  const [openDialog, setOpenDialog] = useState(false);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [dataFileName, setDataFileName] = useState(DEFAULT_DATA_FILE_NAME);
  const [listRightPdding, setListRightPadding] = useState(0);

  const recordedData = useContext(RecordedDataContext);

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
      props.setRecordedData({ data: collectedData });
      dispatch("STOP_VALID");
    } else {
      dispatch("STOP_INVALID");
    }
  };

  const handleCancelButtonClick = () => {
    dispatch("CANCEL");
  };

  const handleUploadButtonClick = () => {
    setDataFileName(DEFAULT_DATA_FILE_NAME);
    setOpenUploadDialog(true);
  };

  const handleDoneButtonClick = () => {
    dispatch("DONE");
  };

  const handlePlaybackButtonClick = () => {
    stateStore = state;
    testCaseStore = testCase;
    props.changePage(Page.Playback);
  };

  const handleOpenDialogButtonClick = () => {
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setOpenDialog(false);
  };

  const handleDialogOkayButtonClick = () => {
    handleDialogClose();
  };

  const handleUploadDialogClose = () => {
    setOpenUploadDialog(false);
  };

  const handleUploadDialogCancelButtonClick = () => {
    handleUploadDialogClose();
  };

  const handleUploadDialogUploadButtonClick = async () => {
    const fileName = dataFileName;
    handleUploadDialogClose();
    dispatch("UPLOAD");
    try {
      const endpoint = "add_attachment_to_case/" + testCase.id;
      const jsonData = JSON.stringify({
        data: collectedData
      });
      const blob = new Blob([jsonData], { type: "application/json" });
      const formData = new FormData();
      formData.append("attachment", blob, fileName);
      const attachment = await testRailRequest(endpoint, "POST", formData);
      console.log(`Attachment ID: ${attachment.attachment_id}`);
    } catch (error) {
      console.error(error);
      dispatch("UPLOAD_FAILED");
      return;
    }
    dispatch("UPLOADED");
  };

  const handleTextFieldChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDataFileName(event.target.value);
  };

  const handleTextFieldKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.keyCode === 13) {
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (event.stopPropagation) {
        event.stopPropagation();
      }
      handleUploadDialogUploadButtonClick();
    }
  };

  const handleTestRailButtonClick = (testCaseID: number) => {
    window.open(TESTRAIL_CASES_VIEW_URL + testCaseID, "_blank")?.focus();
  };

  const handleListItemClick = (item: any) => {
    if (state === State.collecting || state === State.uploading) {
      return;
    }
    if (testCase && testCase.id === item.id) {
      return;
    }
    setTestCase(item);
    dispatch("SELECT");
  };

  const generateMessage = (): JSX.Element => {
    let message: string;
    switch (state) {
      case State.idle:
        message = "Select Test Case";
        break;
      case State.selected:
        message = testCase.title;
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
      case State.upload_failed:
        message = "Upload Failed";
        break;
      default:
        message = "Select Test Case";
    }
    return (
      <Typography sx={state === State.upload_failed ? { color: "red" } : null}>
        {message}
      </Typography>
    );
  };

  const generateListItems = (): JSX.Element[] => {
    return props.testCases.map((item: any, index: number) => {
      const selected = testCase === null ? false : testCase.id === item.id;
      return (
        <div
          key={index}
          style={{
            position: "relative"
          }}
        >
          <ListItem
            divider
            secondaryAction={
              <IconButton
                edge="start"
                onClick={() => handleTestRailButtonClick(item.id)}
              >
                <SvgIcon>
                  <TestRailIcon />
                </SvgIcon>
              </IconButton>
            }
          >
            <ListItemButton
              selected={selected}
              onClick={() => handleListItemClick(item)}
              sx={{ marginRight: "16px", padding: "0px 16px" }}
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
      case State.upload_failed:
        return (
          <Stack spacing={2} direction="row">
            <Button
              disabled={state === State.uploading}
              onClick={() => handleCancelButtonClick()}
              sx={{
                width: "150px"
              }}
            >
              Cancel
            </Button>
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
    return testCase.custom_steps
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
  }, [props.testCases]);

  useEffect(() => {
    collectedData = recordedData.data;
  }, [recordedData]);

  useEffect(() => {
    stateStore = initialState;
    testCaseStore = initialTestCase;
  }, []);

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
          <Stack
            sx={{
              position: "absolute",
              top: "50%",
              right: "24px",
              transform: "translate(0%, -50%)"
            }}
          >
            {(state === State.collected_valid ||
              state === State.uploading ||
              state === State.uploaded ||
              state === State.upload_failed) && (
              <Button
                variant="text"
                disabled={state === State.uploading}
                onClick={() => handlePlaybackButtonClick()}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color:
                      state === State.uploading
                        ? "colors.grey"
                        : props.fontColor,
                    textDecoration: "underline"
                  }}
                >
                  Playback
                </Typography>
              </Button>
            )}
            <Button
              variant="text"
              disabled={
                state === State.idle ||
                state === State.collecting ||
                state === State.uploading ||
                state === State.collected_invalid
              }
              onClick={() => handleOpenDialogButtonClick()}
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
                      : props.fontColor,
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
          </Stack>
        </Box>
      </Stack>
      {state !== State.idle && (
        <>
          <Dialog
            fullWidth
            maxWidth={
              state === State.selected || state === State.collecting
                ? "xs"
                : "md"
            }
            open={openDialog}
            onClose={handleDialogClose}
          >
            <DialogTitle sx={{ textAlign: "center" }}>
              {testCase.title}
            </DialogTitle>
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
          <Dialog
            fullWidth
            maxWidth="xs"
            open={openUploadDialog}
            onClose={handleUploadDialogClose}
          >
            <DialogTitle sx={{ textAlign: "center" }}>
              {testCase.title}
            </DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                variant="standard"
                label="Name of Data File"
                type="text"
                value={dataFileName}
                onChange={handleTextFieldChange}
                onKeyDown={handleTextFieldKeyDown}
                InputLabelProps={{
                  shrink: true
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => handleUploadDialogCancelButtonClick()}
                sx={{ width: "100px" }}
              >
                Cancel
              </Button>
              <Button
                disabled={dataFileName === ""}
                onClick={() => handleUploadDialogUploadButtonClick()}
                sx={{ width: "100px" }}
              >
                Upload
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </>
  );
};
