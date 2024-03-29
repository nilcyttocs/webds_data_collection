import React, { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { ThemeProvider } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { TouchcommADCReport } from '@webds/service';

import {
  ALERT_MESSAGE_APP_INFO,
  ALERT_MESSAGE_PACKRAT_ID,
  ALERT_MESSAGE_RELOAD_TEST_CASES,
  ALERT_MESSAGE_RETRIEVE_CFG,
  ALERT_MESSAGE_RETRIEVE_TEST_CASES,
  ALERT_MESSAGE_SUITE_ID_IN_CFG,
  TESTRAIL_URL
} from './constants';
import Landing, { State } from './Landing';
import { requestAPI, webdsService } from './local_exports';
import { ProgressButton } from './mui_extensions/Buttons';
import Playback from './Playback';

export enum Page {
  Landing = 'LANDING',
  Playback = 'PLAYBACK'
}

export type ADCData = TouchcommADCReport[];

type StashedData = {
  testCaseID: number;
  data: any;
  fileName: string;
};

export const ADCDataContext = React.createContext([] as ADCData);

let cancelDequeue = false;

let suiteID: number;

const testRailRequest = async (
  endpoint: string,
  method: string,
  body: any = null
): Promise<any> => {
  const requestHeaders: HeadersInit = new Headers();
  if (body && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    requestHeaders.set('Content-Type', 'application/json');
  }

  const request = new Request(TESTRAIL_URL + endpoint, {
    method,
    mode: 'cors',
    headers: requestHeaders,
    referrerPolicy: 'no-referrer',
    body
  });

  let response: Response;
  try {
    response = await fetch(request);
  } catch (error) {
    console.error(`Error - ${method} ${TESTRAIL_URL + endpoint}\n${error}`);
    return Promise.reject(
      `Failed to get response from ${TESTRAIL_URL + endpoint}`
    );
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch {
      console.log(`Not JSON response body from ${TESTRAIL_URL + endpoint}`);
    }
  }

  if (!response.ok) {
    return Promise.reject(
      `Received status ${response.status} from ${TESTRAIL_URL + endpoint}`
    );
  }

  return data;
};

export const uploadAttachment = async (
  testCaseID: number,
  data: any,
  fileName: string
) => {
  try {
    const endpoint = 'add_attachment_to_case/' + testCaseID;
    const jsonData = JSON.stringify(data);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const formData = new FormData();
    formData.append('attachment', blob, fileName);
    const attachment = await testRailRequest(endpoint, 'POST', formData);
    console.log(`Attachment ID: ${attachment.attachment_id}`);
  } catch (error) {
    console.error(error);
    return Promise.reject('Failed to upload attachment to TestRail');
  }
};

const getTestCasesFromTestRail = async (): Promise<any[]> => {
  let projectID: number;
  try {
    const endpoint = 'get_suite/' + suiteID;
    const response = await testRailRequest(endpoint, 'GET');
    projectID = response.project_id;
    console.log(`Project ID: ${projectID}`);
  } catch (error) {
    return Promise.reject(error);
  }

  const sectionIDs: number[] = [];
  try {
    const endpoint = 'get_sections/' + projectID! + '&suite_id=' + suiteID;
    const response = await testRailRequest(endpoint, 'GET');
    console.log(response);
    const ifpSection = response.sections.find((item: any) => {
      return item.name.toLowerCase() === 'ifp';
    });
    if (ifpSection) {
      response.sections.forEach((item: any) => {
        if (item.parent_id === ifpSection.id) {
          sectionIDs.push(item.id);
        }
      });
    }
  } catch (error) {
    return Promise.reject(error);
  }

  const testCases: any[] = [];
  try {
    const endpoint = 'get_cases/' + projectID! + '&suite_id=' + suiteID;
    const response = await testRailRequest(endpoint, 'GET');
    console.log(response);
    response.cases.forEach((item: any) => {
      if (sectionIDs.includes(item.section_id)) {
        testCases.push(item);
      }
    });
  } catch (error) {
    return Promise.reject(error);
  }

  return testCases;
};

const updateTestCases = async (): Promise<any[]> => {
  try {
    const testCases = await getTestCasesFromTestRail();
    const content = new Blob([JSON.stringify(testCases)], {
      type: 'application/json'
    });
    const formData = new FormData();
    formData.append('blob', content, 'test_cases.json');
    try {
      await requestAPI<any>('testrail/suites/' + suiteID, {
        body: formData,
        method: 'POST'
      });
    } catch (error) {
      console.error(`Error - POST /webds/testrail/suites/${suiteID}\n${error}`);
    }
    return testCases;
  } catch (error) {
    return Promise.reject(error);
  }
};

const getTestCases = async (): Promise<any[]> => {
  let packratID: number;
  try {
    packratID = await webdsService.touchcomm.getPackratID();
  } catch (error) {
    console.error(error);
    return Promise.reject(ALERT_MESSAGE_PACKRAT_ID);
  }

  try {
    const cfg = await requestAPI<any>(`packrat/${packratID}/cfg.json`);
    if ('testSuiteID' in cfg) {
      suiteID = cfg.testSuiteID;
    }
  } catch (error) {
    console.error(error);
  }
  if (suiteID === undefined) {
    try {
      const cfg = await webdsService.packrat.fetch.getCfgFile();
      const cfgSplitted = cfg.replace(/\n/g, ' ').split(' ');
      const index = cfgSplitted.indexOf(';TEST_SUITE');
      if (index !== -1) {
        suiteID = Number(cfgSplitted[index + 1]);
        console.log(`Suite ID: ${suiteID}`);
        const content = new Blob([JSON.stringify({ testSuiteID: suiteID })], {
          type: 'application/json'
        });
        const formData = new FormData();
        formData.append('blob', content, 'cfg.json');
        try {
          await requestAPI<any>('packrat/' + packratID, {
            body: formData,
            method: 'POST'
          });
        } catch (error) {
          console.error(`Error - POST /webds/packrat/${packratID}\n${error}`);
        }
      } else {
        console.error(ALERT_MESSAGE_SUITE_ID_IN_CFG);
        return Promise.reject(ALERT_MESSAGE_SUITE_ID_IN_CFG);
      }
    } catch (error) {
      console.error(error);
      return Promise.reject(ALERT_MESSAGE_RETRIEVE_CFG);
    }
  }

  let testCases: any = undefined;
  try {
    testCases = await requestAPI<any>(
      `testrail/suites/${suiteID}/test_cases.json`
    );
  } catch (error) {
    console.error(error);
  }
  if (testCases === undefined) {
    try {
      testCases = await updateTestCases();
    } catch (error) {
      console.error(error);
      return Promise.reject(ALERT_MESSAGE_RETRIEVE_TEST_CASES);
    }
  }

  return testCases;
};

export const DataCollectionComponent = (props: any): JSX.Element => {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [alert, setAlert] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<Page>(Page.Landing);
  const [online, setOnline] = useState<boolean>(false);
  const [colsRows, setColsRows] = useState<[number, number]>([0, 0]);
  const [state, setState] = useState<State>(State.idle);
  const [testCase, setTestCase] = useState<any>(null);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [adcData, setADCData] = useState<ADCData>([]);
  const [stashedData, setStashedData] = useState<StashedData[]>([]);
  const [dequeueStash, setDequeueStash] = useState<boolean>(false);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [openDialog, setOpenDialog] = useState<boolean>(true);
  const [reloading, setReloading] = useState<boolean>(false);

  const webdsTheme = webdsService.ui.getWebDSTheme();

  const changePage = (newPage: Page) => {
    setPage(newPage);
  };

  const reloadTestCases = async () => {
    const backupTestCases = testCases;
    let newTestCases;
    setTestCase(null);
    setReloading(true);
    try {
      newTestCases = await updateTestCases();
    } catch (error) {
      console.error(error);
      setAlert(ALERT_MESSAGE_RELOAD_TEST_CASES);
    } finally {
      setReloading(false);
      if (newTestCases !== undefined) {
        setTestCases(newTestCases);
      } else {
        setTestCases(backupTestCases);
      }
    }
  };

  const displayPage = (): JSX.Element | null => {
    switch (page) {
      case Page.Landing:
        return (
          <Landing
            setAlert={setAlert}
            changePage={changePage}
            state={state}
            setState={setState}
            testCase={testCase}
            setTestCase={setTestCase}
            testCases={testCases}
            setADCData={setADCData}
            online={online}
            reloadTestCases={reloadTestCases}
          />
        );
      case Page.Playback:
        return (
          <Playback
            setAlert={setAlert}
            changePage={changePage}
            numCols={colsRows[0]}
            numRows={colsRows[1]}
          />
        );
      default:
        return null;
    }
  };

  const handleDialogClose = (event: object, reason: string) => {
    if (
      progress !== undefined &&
      progress < 100 &&
      reason === 'backdropClick'
    ) {
      return;
    }
    setOpenDialog(false);
  };

  const handleDialogCancelButtonClick = () => {
    if (progress === undefined) {
      setDequeueStash(false);
      setOpenDialog(false);
    } else {
      cancelDequeue = true;
    }
  };

  const handleDialogUploadButtonClick = async () => {
    const total = stashedData.length;
    let remainingData = stashedData;
    for (let i = 0; i < stashedData.length; i++) {
      try {
        if (cancelDequeue) {
          break;
        }
        setProgress((i / total) * 100);
        await uploadAttachment(
          stashedData[i].testCaseID,
          stashedData[i].data,
          stashedData[i].fileName
        );
        remainingData = stashedData.slice(i + 1, stashedData.length);
      } catch (error) {
        console.error(error);
        break;
      }
    }
    let dataToSend: any;
    if (remainingData.length > 0) {
      dataToSend = {
        request: 'overwrite',
        data: { stash: remainingData }
      };
    } else {
      dataToSend = { request: 'flush' };
    }
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
    setProgress(100);
  };

  const handleDialogDoneButtonClick = () => {
    setDequeueStash(false);
    setOpenDialog(false);
  };

  useEffect(() => {
    const initialize = async () => {
      const dataToSend: any = {
        command: 'getAppInfo'
      };
      try {
        const response = await requestAPI<any>('command', {
          body: JSON.stringify(dataToSend),
          method: 'POST'
        });
        if (response.numCols && response.numRows) {
          setColsRows([response.numCols, response.numRows]);
        }
      } catch (error) {
        console.error(`Error - POST /webds/command\n${dataToSend}\n${error}`);
        setAlert(ALERT_MESSAGE_APP_INFO);
        return;
      }

      let testCases: any;
      try {
        testCases = await getTestCases();
      } catch (error) {
        setAlert(error as string);
        return;
      }

      setTestCases(testCases);
      setInitialized(true);
    };

    if (!openDialog) {
      initialize();
    }
  }, [openDialog]);

  useEffect(() => {
    const checkStash = async () => {
      try {
        const response = await requestAPI<any>('data-collection');
        setStashedData(response.stash);
        if (response.stash.length > 0) {
          cancelDequeue = false;
          setDequeueStash(true);
          setOpenDialog(true);
        } else {
          setOpenDialog(false);
        }
      } catch (error) {
        console.error(`Error - GET /webds/data-collection\n${error}`);
      }
    };
    if (webdsService.pinormos.isTestRailOnline()) {
      setOnline(true);
      checkStash();
    } else {
      setOnline(false);
      setOpenDialog(false);
    }
  }, []);

  return (
    <>
      <ThemeProvider theme={webdsTheme}>
        <div className="jp-webds-widget-body">
          {dequeueStash ? (
            <Dialog
              fullWidth
              maxWidth="xs"
              open={openDialog}
              onClose={handleDialogClose}
            >
              <DialogTitle sx={{ textAlign: 'center' }}>
                Data Available in Stash
              </DialogTitle>
              <DialogContent>
                <Typography variant="body1">
                  {stashedData.length > 1
                    ? stashedData.length + ' sets '
                    : stashedData.length + ' set '}
                  of data availabe in stash. Upload stashed data to TestRail?
                </Typography>
              </DialogContent>
              <DialogActions>
                {progress === undefined && (
                  <Button
                    onClick={handleDialogCancelButtonClick}
                    sx={{ width: '100px' }}
                  >
                    Cancel
                  </Button>
                )}
                <ProgressButton
                  progress={progress}
                  onClick={handleDialogUploadButtonClick}
                  onDoneClick={handleDialogDoneButtonClick}
                  onCancelClick={handleDialogCancelButtonClick}
                  progressMessage="Uploading..."
                  sx={{ width: '100px', marginLeft: '8px' }}
                >
                  Upload
                </ProgressButton>
              </DialogActions>
            </Dialog>
          ) : (
            <>
              {alert !== undefined && (
                <Alert
                  severity="error"
                  onClose={() => setAlert(undefined)}
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {alert}
                </Alert>
              )}
              {initialized && (
                <ADCDataContext.Provider value={adcData}>
                  {displayPage()}
                </ADCDataContext.Provider>
              )}
            </>
          )}
        </div>
        {((!dequeueStash && !initialized) || reloading) && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <CircularProgress color="primary" />
          </div>
        )}
      </ThemeProvider>
    </>
  );
};

export default DataCollectionComponent;
