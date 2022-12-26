import React from "react";

import { ReactWidget } from "@jupyterlab/apputils";

import { WebDSService } from "@webds/service";

import DataCollectionComponent from "./DataCollectionComponent";

export let webdsService: WebDSService;

export class DataCollectionWidget extends ReactWidget {
  id: string;
  service: WebDSService | null = null;

  constructor(id: string, service: WebDSService) {
    super();
    this.id = id;
    this.service = service;
  }

  render(): JSX.Element {
    webdsService = this.service;
    return (
      <div id={this.id + "_component"}>
        <DataCollectionComponent />
      </div>
    );
  }
}

export default DataCollectionWidget;
