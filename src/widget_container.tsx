import React, { useEffect, useState } from "react";

import { ReactWidget } from "@jupyterlab/apputils";

import Alert from "@mui/material/Alert";

import CircularProgress from "@mui/material/CircularProgress";

import { ThemeProvider } from "@mui/material/styles";

import { WebDSService } from "@webds/service";

import { Landing } from "./widget_landing";

const testRailURL = "http://nexus.synaptics.com:8083/TestRail/";

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

const testRailRequest = async (
  endpoint: string,
  method: string,
  body: any = null
): Promise<any> => {
  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set("Content-Type", "application/json");

  const request = new Request(testRailURL + endpoint, {
    method: method,
    mode: "cors",
    headers: requestHeaders,
    referrerPolicy: "no-referrer",
    body: body ? JSON.stringify(body) : null
  });

  let response: Response;
  try {
    response = await fetch(request);
  } catch (error) {
    console.error(`Error - ${method} ${testRailURL + endpoint}\n${error}`);
    return Promise.reject(
      `Failed to get response from ${testRailURL + endpoint}`
    );
  }

  let data: any = await response.text();

  if (data.length > 0) {
    try {
      data = JSON.parse(data);
    } catch {
      console.log(`Not JSON response body from ${testRailURL + endpoint}`);
    }
  }

  if (!response.ok) {
    return Promise.reject(
      `Received status ${response.status} from ${testRailURL + endpoint}`
    );
  }

  return data;
};

const DataCollectionContainer = (props: any): JSX.Element => {
  const [initialized, setInitialized] = useState<boolean>(false);
  const [alert, setAlert] = useState<boolean>(false);
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    const initialize = async () => {
      let suiteID: number;
      try {
        const cfg = await props.service.packrat.fetch.getCfgFile();
        const cfgSplitted = cfg.replace(/\n/g, " ").split(" ");
        const index = cfgSplitted.indexOf(";TEST_SUITE");
        if (index !== -1) {
          suiteID = cfgSplitted[index + 1];
          console.log(`Suite ID: ${suiteID}`);
        }
      } catch (error) {
        console.error("Failed to fetch cfg file");
        return;
      }

      let projectID: number;
      try {
        const endpoint = "get_suite/" + suiteID!;
        const suite = await testRailRequest(endpoint, "GET");
        projectID = suite.project_id;
        console.log(`Project ID: ${projectID}`);
      } catch (error) {
        console.error(error);
        return;
      }

      const sectionIDs: number[] = [];
      try {
        const endpoint = "get_sections/" + projectID! + "&suite_id=" + suiteID!;
        const sections = await testRailRequest(endpoint, "GET");
        console.log(sections);
        sections.sections.forEach((item: any) => {
          if (item.name.toLowerCase().includes("finger")) {
            sectionIDs.push(item.id);
          }
        });
      } catch (error) {
        console.error(error);
        return;
      }

      const testCases: any[] = [];
      try {
        const endpoint = "get_cases/" + projectID! + "&suite_id=" + suiteID!;
        const cases = await testRailRequest(endpoint, "GET");
        console.log(cases);
        cases.cases.forEach((item: any) => {
          if (sectionIDs.includes(item.section_id)) {
            testCases.push(item);
          }
        });
      } catch (error) {
        console.error(error);
        return;
      }

      setTests(testCases);

      setInitialized(true);
    };
    initialize();
  }, []);

  const webdsTheme = props.service.ui.getWebDSTheme();

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
            <Landing
              dimensions={dimensions}
              service={props.service}
              tests={tests}
            />
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

export class DataCollectionWidget extends ReactWidget {
  id: string;
  service: WebDSService | null = null;

  constructor(id: string, service: WebDSService) {
    super();
    this.id = id;
    this.service = service;
  }

  render(): JSX.Element {
    return (
      <div id={this.id + "_container"} className="jp-webds-widget-container">
        <div id={this.id + "_content"} className="jp-webds-widget">
          <DataCollectionContainer service={this.service} />
        </div>
        <div className="jp-webds-widget-shadow jp-webds-widget-shadow-top"></div>
        <div className="jp-webds-widget-shadow jp-webds-widget-shadow-bottom"></div>
      </div>
    );
  }
}
