import React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';

import DataCollectionComponent from './DataCollectionComponent';

export class DataCollectionWidget extends ReactWidget {
  id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }

  render(): JSX.Element {
    return (
      <div id={this.id + '_component'}>
        <DataCollectionComponent />
      </div>
    );
  }
}

export default DataCollectionWidget;
