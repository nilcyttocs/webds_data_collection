import React from "react";

import { ReactWidget } from "@jupyterlab/apputils";

import { WebDSService } from "@webds/service";

import DataCollectionComponent from "./DataCollectionComponent";

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
          <DataCollectionComponent service={this.service} />
        </div>
        <div className="jp-webds-widget-shadow jp-webds-widget-shadow-top"></div>
        <div className="jp-webds-widget-shadow jp-webds-widget-shadow-bottom"></div>
      </div>
    );
  }
}

export default DataCollectionWidget;
