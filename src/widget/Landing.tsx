import React, { useEffect, useReducer, useState } from 'react';

import InfoIcon from '@mui/icons-material/Info';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { TouchcommADCReport } from '@webds/service';

import { DEFAULT_DATA_FILE_NAME, TESTRAIL_CASES_VIEW_URL } from './constants';
import { Page, uploadAttachment } from './DataCollectionComponent';
import { requestAPI } from './local_exports';
import { Canvas } from './mui_extensions/Canvas';
import { Content } from './mui_extensions/Content';
import { Controls } from './mui_extensions/Controls';

export enum State {
  idle = 'IDLE',
  selected = 'SELECTED',
  collecting = 'COLLECTING',
  collect_failed = 'COLLECT_FAILED',
  collected_valid = 'COLLECTED_VALID',
  collected_invalid = 'COLLECTED_INVALID',
  uploading = 'UPLOADING',
  uploaded = 'UPLOADED',
  upload_failed = 'UPLOAD_FAILED',
  stashing = 'STASHING',
  stashed = 'STASHED',
  stash_failed = 'STASH_FAILED'
}

type TransitionType = {
  [T: string]: State;
};

type StateType = {
  [key in State]: TransitionType;
};

const nextStateGraph: StateType = {
  [State.idle]: {
    RELOAD: State.idle,
    SELECT: State.selected
  },
  [State.selected]: {
    RELOAD: State.idle,
    SELECT: State.selected,
    COLLECT: State.collecting,
    COLLECT_FAILED: State.collect_failed
  },
  [State.collecting]: {
    STOP_VALID: State.collected_valid,
    STOP_INVALID: State.collected_invalid
  },
  [State.collect_failed]: {
    RELOAD: State.idle,
    SELECT: State.selected,
    COLLECT: State.collecting,
    COLLECT_FAILED: State.collect_failed
  },
  [State.collected_valid]: {
    SELECT: State.selected,
    CANCEL: State.selected,
    UPLOAD: State.uploading,
    STASH: State.stashing
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
  },
  [State.stashing]: {
    STASHED: State.stashed,
    STASH_FAILED: State.stash_failed
  },
  [State.stashed]: {
    SELECT: State.selected,
    DONE: State.selected
  },
  [State.stash_failed]: {
    SELECT: State.selected,
    CANCEL: State.selected,
    STASH: State.stashing
  }
};

const SSE_CLOSED = 2;
const REPORT_FPS = 120;

const REPORT_RAW = 19;

let eventSource: EventSource | undefined;
let eventData: TouchcommADCReport;

let collectedData: TouchcommADCReport[] = [];
let staticConfig: any = {};

let flush: boolean;

const readStaticConfig = async () => {
  staticConfig = {};
  const dataToSend = {
    command: 'getStaticConfig'
  };
  try {
    staticConfig = await requestAPI<any>('command', {
      body: JSON.stringify(dataToSend),
      method: 'POST'
    });
  } catch (error) {
    console.error(`Error - POST /webds/command\n${dataToSend}\n${error}`);
  }
};

const eventHandler = (event: any) => {
  const data = JSON.parse(event.data);
  if (!data || !data.report || data.report[0] !== 'raw') {
    return;
  }
  if (flush) {
    flush = false;
    return;
  }
  eventData = data.report;
  collectedData.push(eventData);
};

const errorHandler = (error: any) => {
  console.error(`Error - GET /webds/report\n${error}`);
};

const removeEvent = () => {
  if (eventSource && eventSource.readyState !== SSE_CLOSED) {
    eventSource.removeEventListener('report', eventHandler, false);
    eventSource.removeEventListener('error', errorHandler, false);
    eventSource.close();
    eventSource = undefined;
  }
};

const addEvent = () => {
  if (eventSource) {
    return;
  }
  eventSource = new window.EventSource('/webds/report');
  eventSource.addEventListener('report', eventHandler, false);
  eventSource.addEventListener('error', errorHandler, false);
};

const setReportTypes = async (
  enable: number[],
  disable: number[]
): Promise<void> => {
  const dataToSend = { enable, disable, fps: REPORT_FPS };
  try {
    await requestAPI<any>('report', {
      body: JSON.stringify(dataToSend),
      method: 'POST'
    });
  } catch (error) {
    console.error(`Error - POST /webds/report\n${error}`);
    return Promise.reject('Failed to enable/disable report types');
  }
  return Promise.resolve();
};

const enableReport = async (enable: boolean) => {
  try {
    await setReportTypes(
      enable ? [REPORT_RAW] : [],
      enable ? [] : [REPORT_RAW]
    );
    if (enable) {
      collectedData = [];
      addEvent();
    }
  } catch (error) {
    console.error(error);
    return Promise.reject();
  }
};

const reducer = (state: State, action: string) => {
  const nextState = nextStateGraph[state][action];
  if (nextState === undefined) {
    return state;
  } else {
    return nextState;
  }
};

export const Landing = (props: any): JSX.Element => {
  const [state, dispatch] = useReducer(reducer, props.state);
  const [stepsCase, setStepsCase] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [listRightPdding, setListRightPadding] = useState<number>(0);

  const theme = useTheme();

  const handleCollectButtonClick = async () => {
    try {
      await enableReport(true);
      dispatch('COLLECT');
    } catch {
      dispatch('COLLECT_FAILED');
    }
  };

  const handleStopButtonClick = async () => {
    removeEvent();
    if (collectedData.length > 0) {
      await readStaticConfig();
      props.setADCData(collectedData);
      dispatch('STOP_VALID');
    } else {
      dispatch('STOP_INVALID');
    }
  };

  const handleCancelButtonClick = () => {
    dispatch('CANCEL');
  };

  const handleUploadButtonClick = async () => {
    dispatch('UPLOAD');
    try {
      await uploadAttachment(
        props.testCase.id,
        { data: collectedData },
        DEFAULT_DATA_FILE_NAME
      );
    } catch (error) {
      console.error(error);
      dispatch('UPLOAD_FAILED');
      return;
    }
    try {
      await uploadAttachment(
        props.testCase.id,
        staticConfig,
        'static_config.json'
      );
    } catch (error) {
      console.error(error);
      dispatch('UPLOAD_FAILED');
      return;
    }
    dispatch('UPLOADED');
  };

  const handleStashButtonClick = async () => {
    dispatch('STASH');
    let dataToSend: any = {
      request: 'append',
      data: {
        testCaseID: props.testCase.id,
        data: { data: collectedData },
        fileName: DEFAULT_DATA_FILE_NAME
      }
    };
    try {
      await requestAPI<any>('data-collection', {
        body: JSON.stringify(dataToSend),
        method: 'POST'
      });
    } catch (error) {
      console.error(
        `Error - POST /webds/data-collection\n${dataToSend}\n${error}`
      );
    }
    dataToSend = {
      request: 'append',
      data: {
        testCaseID: props.testCase.id,
        data: staticConfig,
        fileName: 'static_config.json'
      }
    };
    try {
      await requestAPI<any>('data-collection', {
        body: JSON.stringify(dataToSend),
        method: 'POST'
      });
    } catch (error) {
      console.error(
        `Error - POST /webds/data-collection\n${dataToSend}\n${error}`
      );
    }
    dispatch('STASHED');
  };

  const handleDoneButtonClick = () => {
    dispatch('DONE');
  };

  const handlePlaybackButtonClick = () => {
    props.changePage(Page.Playback);
  };

  const handleOpenDialogButtonClick = () => {
    setOpenDialog(true);
  };

  const handleDialogClose = (event: object, reason: string) => {
    setOpenDialog(false);
  };

  const handleDialogOkayButtonClick = () => {
    setOpenDialog(false);
  };

  const handleTestRailButtonClick = (testCaseID: number) => {
    window.open(TESTRAIL_CASES_VIEW_URL + testCaseID, '_blank')?.focus();
  };

  const handleListItemClick = (item: any) => {
    if (
      state === State.collecting ||
      state === State.uploading ||
      state === State.stashing
    ) {
      return;
    }
    if (props.testCase && props.testCase.id === item.id) {
      return;
    }
    props.setTestCase(item);
    dispatch('SELECT');
  };

  const generateMessage = (): JSX.Element => {
    let message: string;
    switch (state) {
      case State.idle:
        message = props.testCases.length ? 'Select Test Case' : '';
        break;
      case State.selected:
        message = props.testCase.title;
        break;
      case State.collecting:
        message = 'Collecting...';
        break;
      case State.collect_failed:
        message = 'Failed to collect data';
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
        message = 'Uploading...';
        break;
      case State.uploaded:
        if (collectedData.length > 1) {
          message = `${collectedData.length} Frames Uploaded`;
        } else {
          message = `${collectedData.length} Frame Uploaded`;
        }
        break;
      case State.upload_failed:
        message = 'Failed to upload data';
        break;
      case State.stashing:
        message = 'Stashing...';
        break;
      case State.stashed:
        if (collectedData.length > 1) {
          message = `${collectedData.length} Frames Stashed`;
        } else {
          message = `${collectedData.length} Frame Stashed`;
        }
        break;
      case State.stash_failed:
        message = 'Failed to stash data';
        break;
      default:
        message = 'Select Test Case';
    }
    return (
      <Typography
        sx={
          state === State.upload_failed || state === State.stash_failed
            ? { color: 'red' }
            : null
        }
      >
        {message}
      </Typography>
    );
  };

  const generateListItems = (): JSX.Element[] => {
    return props.testCases.map((item: any, index: number) => {
      const selected =
        props.testCase === null ? false : props.testCase.id === item.id;
      return (
        <div
          key={index}
          style={{
            position: 'relative'
          }}
        >
          <ListItem
            divider
            secondaryAction={
              <IconButton
                edge="start"
                onClick={() => {
                  setStepsCase(item);
                  handleOpenDialogButtonClick();
                }}
              >
                <InfoIcon color="primary" />
              </IconButton>
            }
          >
            <ListItemButton
              selected={selected}
              onClick={() => handleListItemClick(item)}
              sx={{ marginRight: '16px', padding: '0px 16px' }}
            >
              <ListItemText primary={item.title} />
            </ListItemButton>
          </ListItem>
          {selected &&
            (state === State.collecting ||
              state === State.uploading ||
              state === State.stashing) && (
              <LinearProgress
                sx={{
                  position: 'absolute',
                  bottom: '0px',
                  width: '100%'
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
      case State.collect_failed:
      case State.collected_invalid:
        return (
          <Button
            disabled={state === State.idle}
            onClick={() => handleCollectButtonClick()}
            sx={{ width: '150px' }}
          >
            Collect
          </Button>
        );
      case State.collecting:
        return (
          <Button
            onClick={() => handleStopButtonClick()}
            sx={{ width: '150px' }}
          >
            Stop
          </Button>
        );
      case State.collected_valid:
      case State.uploading:
      case State.upload_failed:
      case State.stashing:
      case State.stash_failed:
        return (
          <Stack spacing={2} direction="row">
            <Button
              disabled={state === State.uploading || state === State.stashing}
              onClick={() => handleCancelButtonClick()}
              sx={{
                width: '150px'
              }}
            >
              Cancel
            </Button>
            {props.online ? (
              <Button
                disabled={state === State.uploading}
                onClick={() => handleUploadButtonClick()}
                sx={{
                  width: '150px'
                }}
              >
                Upload
              </Button>
            ) : (
              <Button
                disabled={state === State.stashing}
                onClick={() => handleStashButtonClick()}
                sx={{
                  width: '150px'
                }}
              >
                Stash
              </Button>
            )}
          </Stack>
        );
      case State.uploaded:
      case State.stashed:
        return (
          <Button
            onClick={() => handleDoneButtonClick()}
            sx={{ width: '150px' }}
          >
            Done
          </Button>
        );
      default:
        return (
          <Button disabled sx={{ width: '150px' }}>
            Collect
          </Button>
        );
    }
  };

  const generateTestSteps = (): JSX.Element[] => {
    return stepsCase?.custom_steps
      .match(/(\d+\.\s?)?(.*?)(\r\n|\r|\n|$)/g)
      .map((item: string, index: number) => {
        item = item.replace(/(\r\n|\r|\n)/gm, '').trim();
        if (item === '') {
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
    const element = document.getElementById('webds_data_collection_test_list');
    if (element && element.scrollHeight > element.clientHeight) {
      setListRightPadding(8);
    } else {
      setListRightPadding(0);
    }
    dispatch('RELOAD');
  }, [props.testCases]);

  useEffect(() => {
    props.setState(state);
  }, [state]);

  useEffect(() => {
    flush = true;
    return () => {
      enableReport(false);
      removeEvent();
    };
  }, []);

  return (
    <>
      <Canvas
        title="Test Data Collection"
        annotation={props.online ? null : 'offline mode'}
      >
        <Content
          sx={{
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              margin: '0px auto 24px auto'
            }}
          >
            {generateMessage()}
          </div>
          <div
            id="webds_data_collection_test_list"
            style={{
              paddingRight: listRightPdding,
              overflow: 'auto'
            }}
          >
            <List sx={{ padding: '0px' }}>{generateListItems()}</List>
          </div>
        </Content>
        <Controls
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {generateControls()}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'end',
              position: 'absolute',
              top: '50%',
              right: '24px',
              transform: 'translate(0%, -50%)'
            }}
          >
            <Button
              variant="text"
              disabled={
                state === State.idle ||
                state === State.collecting ||
                state === State.uploading ||
                state === State.stashing ||
                state === State.collected_invalid
              }
              onClick={
                state === State.idle ||
                state === State.selected ||
                state === State.collect_failed ||
                state === State.collecting
                  ? () => handleTestRailButtonClick(props.testCase.id)
                  : () => handlePlaybackButtonClick()
              }
            >
              <Typography
                variant="underline"
                sx={{
                  color:
                    state === State.idle ||
                    state === State.collecting ||
                    state === State.uploading ||
                    state === State.stashing ||
                    state === State.collected_invalid
                      ? theme.palette.text.disabled
                      : theme.palette.text.primary
                }}
              >
                {state === State.idle ||
                state === State.selected ||
                state === State.collect_failed ||
                state === State.collecting
                  ? 'View in TestRail'
                  : 'Playback'}
              </Typography>
            </Button>
            <Button
              variant="text"
              disabled={
                state === State.collecting ||
                state === State.uploading ||
                state === State.stashing ||
                state === State.collected_invalid
              }
              onClick={
                state === State.idle ||
                state === State.selected ||
                state === State.collect_failed ||
                state === State.collecting
                  ? () => props.reloadTestCases()
                  : () => handleOpenDialogButtonClick()
              }
            >
              <Typography
                variant="underline"
                sx={{
                  color:
                    state === State.collecting ||
                    state === State.uploading ||
                    state === State.stashing ||
                    state === State.collected_invalid
                      ? theme.palette.text.disabled
                      : theme.palette.text.primary
                }}
              >
                {state === State.idle ||
                state === State.selected ||
                state === State.collect_failed ||
                state === State.collecting
                  ? 'Reload Test Cases'
                  : 'View Last Frame'}
              </Typography>
            </Button>
          </div>
        </Controls>
      </Canvas>
      <Dialog
        fullWidth
        maxWidth={
          state === State.idle ||
          state === State.selected ||
          state === State.collect_failed ||
          state === State.collecting
            ? 'xs'
            : 'md'
        }
        open={openDialog}
        onClose={handleDialogClose}
      >
        <DialogTitle sx={{ textAlign: 'center' }}>
          {state === State.idle ||
          state === State.selected ||
          state === State.collect_failed ||
          state === State.collecting
            ? stepsCase?.title
            : props.testCase.title}
        </DialogTitle>
        <DialogContent>
          {state === State.idle ||
          state === State.selected ||
          state === State.collect_failed ||
          state === State.collecting ? (
            <List dense>{generateTestSteps()}</List>
          ) : (
            collectedData.length > 0 && (
              <Typography variant="body2">
                {JSON.stringify(collectedData[collectedData.length - 1][1])}
              </Typography>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogOkayButtonClick} sx={{ width: '100px' }}>
            Okay
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Landing;
