import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from "@jupyterlab/application";

import { WidgetTracker } from "@jupyterlab/apputils";

import { ILauncher } from "@jupyterlab/launcher";

import { WebDSService, WebDSWidget } from "@webds/service";

import { dataCollectionIcon } from "./icons";

import DataCollectionWidget from "./widget/DataCollectionWidget";

namespace Attributes {
  export const command = "webds_data_collection:open";
  export const id = "webds_data_collection_widget";
  export const label = "Test Data Collection";
  export const caption = "Test Data Collection";
  export const category = "Touch - Assessment";
  export const rank = 40;
}

export let webdsService: WebDSService;

/**
 * Initialization data for the @webds/data_collection extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: "@webds/data_collection:plugin",
  autoStart: true,
  requires: [ILauncher, ILayoutRestorer, WebDSService],
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    restorer: ILayoutRestorer,
    service: WebDSService
  ) => {
    console.log("JupyterLab extension @webds/data_collection is activated!");

    webdsService = service;

    let widget: WebDSWidget;
    const { commands, shell } = app;
    const command = Attributes.command;
    commands.addCommand(command, {
      label: Attributes.label,
      caption: Attributes.caption,
      icon: (args: { [x: string]: any }) => {
        return args["isLauncher"] ? dataCollectionIcon : undefined;
      },
      execute: () => {
        if (!widget || widget.isDisposed) {
          const content = new DataCollectionWidget(Attributes.id);
          widget = new WebDSWidget<DataCollectionWidget>({ content });
          widget.id = Attributes.id;
          widget.title.label = Attributes.label;
          widget.title.icon = dataCollectionIcon;
          widget.title.closable = true;
        }

        if (!tracker.has(widget)) tracker.add(widget);

        if (!widget.isAttached) shell.add(widget, "main");

        shell.activateById(widget.id);
      }
    });

    launcher.add({
      command,
      args: { isLauncher: true },
      category: Attributes.category,
      rank: Attributes.rank
    });

    let tracker = new WidgetTracker<WebDSWidget>({
      namespace: Attributes.id
    });
    restorer.restore(tracker, {
      command,
      name: () => Attributes.id
    });
  }
};

export default plugin;
