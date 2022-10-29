import React, { useEffect, useState } from "react";

import Alert from "@mui/material/Alert";

import CircularProgress from "@mui/material/CircularProgress";

import { ThemeProvider } from "@mui/material/styles";

import { TouchcommReport } from "@webds/service";

import Landing from "./Landing";

import Playback from "./Playback";

import { requestAPI } from "../handler";

export enum Page {
  Landing = "LANDING",
  Playback = "PLAYBACK"
}

export type RecordedData = {
  data: TouchcommReport[];
};

export const RecordedDataContext = React.createContext({} as RecordedData);

export const selectFile: any = null;

const TESTRAIL_URL = "http://nexus.synaptics.com:8083/TestRail/";

const WIDTH = 800;
const HEIGHT_TITLE = 70;
const HEIGHT_CONTENT = 450;
const HEIGHT_CONTROLS = 120;

const dimensions = {
  width: WIDTH,
  heightTitle: HEIGHT_TITLE,
  heightContent: HEIGHT_CONTENT,
  heightControls: HEIGHT_CONTROLS
};

let alertMessage = "";

const alertMessageAppInfo = "Failed to read application info from device.";

const alertMessageRetrieveCfg = "Failed to retrieve cfg file.";

const alertMessageSuiteIDInCfg = "Suite ID not available in cfg file.";

const alertMessageRetrieveTestCases = "Failed to retrieve tests cases.";

export const testRailRequest = async (
  endpoint: string,
  method: string,
  body: any = null
): Promise<any> => {
  const requestHeaders: HeadersInit = new Headers();
  if (body && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    requestHeaders.set("Content-Type", "application/json");
  }

  const request = new Request(TESTRAIL_URL + endpoint, {
    method,
    mode: "cors",
    headers: requestHeaders,
    referrerPolicy: "no-referrer",
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

const getTestCases = async (suiteID: number): Promise<any[]> => {
  let projectID: number;
  try {
    const endpoint = "get_suite/" + suiteID;
    const response = await testRailRequest(endpoint, "GET");
    projectID = response.project_id;
    console.log(`Project ID: ${projectID}`);
  } catch (error) {
    Promise.reject(error);
  }

  const sectionIDs: number[] = [];
  try {
    const endpoint = "get_sections/" + projectID! + "&suite_id=" + suiteID;
    const response = await testRailRequest(endpoint, "GET");
    console.log(response);
    const ifpSection = response.sections.find((item: any) => {
      return item.name.toLowerCase() === "ifp";
    });
    if (ifpSection) {
      response.sections.forEach((item: any) => {
        if (item.parent_id === ifpSection.id) {
          sectionIDs.push(item.id);
        }
      });
    }
  } catch (error) {
    Promise.reject(error);
  }

  const testCases: any[] = [];
  try {
    const endpoint = "get_cases/" + projectID! + "&suite_id=" + suiteID;
    const response = await testRailRequest(endpoint, "GET");
    console.log(response);
    response.cases.forEach((item: any) => {
      if (sectionIDs.includes(item.section_id)) {
        testCases.push(item);
      }
    });
  } catch (error) {
    Promise.reject(error);
  }

  return testCases;
};

export const DataCollectionComponent = (props: any): JSX.Element => {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [alert, setAlert] = useState<boolean>(false);
  const [page, setPage] = useState<Page>(Page.Landing);
  const [colsRows, setColsRows] = useState<[number, number]>([0, 0]);
  const [testCases, setTestCases] = useState<any[]>([]);
  const [recordedData, setRecordedData] = useState<RecordedData>({ data: [] });

  const webdsTheme = props.service.ui.getWebDSTheme();

  const changePage = (newPage: Page) => {
    setPage(newPage);
  };

  const displayPage = (): JSX.Element | null => {
    switch (page) {
      case Page.Landing:
        return (
          <Landing
            changePage={changePage}
            dimensions={dimensions}
            testCases={testCases}
            setRecordedData={setRecordedData}
          />
        );
      case Page.Playback:
        return (
          <Playback
            changePage={changePage}
            dimensions={dimensions}
            numCols={colsRows[0]}
            numRows={colsRows[1]}
          />
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const dataToSend: any = {
        command: "getAppInfo"
      };
      try {
        const response = await requestAPI<any>("command", {
          body: JSON.stringify(dataToSend),
          method: "POST"
        });
        if (response.numCols && response.numRows) {
          setColsRows([response.numCols, response.numRows]);
        }
      } catch (error) {
        console.error(`Error - POST /webds/command\n${dataToSend}\n${error}`);
        alertMessage = alertMessageAppInfo;
        setAlert(true);
        return;
      }

      let suiteID: number;
      try {
        const cfg = await props.service.packrat.fetch.getCfgFile();
        const cfgSplitted = cfg.replace(/\n/g, " ").split(" ");
        const index = cfgSplitted.indexOf(";TEST_SUITE");
        if (index !== -1) {
          suiteID = cfgSplitted[index + 1];
          console.log(`Suite ID: ${suiteID}`);
        } else {
          console.error(alertMessageSuiteIDInCfg);
          alertMessage = alertMessageSuiteIDInCfg;
          setAlert(true);
          return;
        }
      } catch (error) {
        console.error(`${alertMessageRetrieveCfg}\n${error}`);
        alertMessage = alertMessageRetrieveCfg;
        setAlert(true);
        return;
      }

      try {
        const testCases = await getTestCases(suiteID!);
        setTestCases(testCases);
      } catch (error) {
        console.error(`${alertMessageRetrieveTestCases}\n${error}`);
        alertMessage = alertMessageRetrieveTestCases;
        setAlert(true);
        return;
      }

      setInitialized(true);
    };

    initialize();
  }, []);

  return (
    <>
      <ThemeProvider theme={webdsTheme}>
        <div className="jp-webds-widget-body">
          {alert && (
            <Alert
              severity="error"
              onClose={() => setAlert(false)}
              sx={{ whiteSpace: "pre-wrap" }}
            >
              {alertMessage}
            </Alert>
          )}
          {initialized && (
            <RecordedDataContext.Provider value={recordedData}>
              {displayPage()}
            </RecordedDataContext.Provider>
          )}
        </div>
        {!initialized && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)"
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
