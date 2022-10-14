import React, { useContext, useEffect, useState } from "react";

import Slider from "@mui/material/Slider";
import LinearProgress from "@mui/material/LinearProgress";

import { TouchcommReport } from "@webds/service";

import Plot from "react-plotly.js";

import { RecordedData, RecordedDataContext } from "../local_exports";

const HEAT_PLOT_WIDTH = 550;
const BAR_PLOT_HEIGHT = 60;

const barYLMargin = 40;
const barYRMargin = 40;
const barYTMargin = 20;
const barYBMargin = 30;

const heatLMargin = 0;
const heatRMargin = 110;
const heatTMargin = barYTMargin;
const heatBMargin = barYBMargin;

const barXLMargin = BAR_PLOT_HEIGHT + barYLMargin + barYRMargin + heatLMargin;
const barXRMargin = 110;
const barXTMargin = 10;
const barXBMargin = 10;

const heatPlotWidth = HEAT_PLOT_WIDTH;
let heatPlotHeight: number;
let heatWidth: number;
let heatHeight: number;
let barYWidth: number;
let barYHeight: number;
let barXWidth: number;
let barXHeight: number;
let plotWidth: number;
let plotHeight: number;

let heatZ: number[][];
let heatZMin: number;
let heatZMax: number;
let barX: number[];
let barXMin: number;
let barXMax: number;
let barY: number[];
let barYMin: number;
let barYMax: number;

let numRows = 0;
let numCols = 0;

const plotConfig = { displayModeBar: false };
const plotBgColor = "rgba(0.75, 0.75, 0.75, 0.1)";
const paperBgColor = "rgba(0, 0, 0, 0)";
const axisLineColor = "rgba(128, 128, 128, 0.5)";

let fontColor: string;
let run: boolean;
let playbackData: RecordedData;

let frameIndex = 0;
let progressIndex = 0;
let numFrames: number;
let requestID: number | undefined;
let progressRequestID: number | undefined;

const delay = (milliseconds: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const stopAnimation = () => {
  if (requestID) {
    cancelAnimationFrame(requestID);
    requestID = undefined;
  }
};

const stopProgressAnimation = () => {
  if (progressRequestID) {
    cancelAnimationFrame(progressRequestID);
    progressRequestID = undefined;
  }
};

const computePlot = (frame: TouchcommReport) => {
  heatZ = frame.image;
  barX = frame.hybridx;
  barY = frame.hybridy;

  if (heatZ === undefined || barX === undefined || barY === undefined) {
    return;
  }

  const minRow = heatZ.map((row: number[]) => {
    return Math.min.apply(Math, row);
  });
  heatZMin = Math.min.apply(Math, minRow);
  const maxRow = heatZ.map((row: number[]) => {
    return Math.max.apply(Math, row);
  });
  heatZMax = Math.max.apply(Math, maxRow);

  barXMin = Math.min.apply(Math, barX);
  barXMax = Math.max.apply(Math, barX);

  barYMin = Math.min.apply(Math, barY);
  barYMax = Math.max.apply(Math, barY);
};

export const PlaybackPlot = (props: any): JSX.Element | null => {
  const [initialized, setInitialized] = useState<boolean>(false);

  const [heatData, setHeatData] = useState<any>([]);
  const [heatConfig, setHeatConfig] = useState<any>({});
  const [heatLayout, setHeatLayout] = useState<any>({});
  const [heatFrames, setHeatFrames] = useState<any>([]);

  const [barXData, setBarXData] = useState<any>([]);
  const [barXConfig, setBarXConfig] = useState<any>({});
  const [barXLayout, setBarXLayout] = useState<any>({});
  const [barXFrames, setBarXFrames] = useState<any>([]);

  const [barYData, setBarYData] = useState<any>([]);
  const [barYConfig, setBarYConfig] = useState<any>({});
  const [barYLayout, setBarYLayout] = useState<any>({});
  const [barYFrames, setBarYFrames] = useState<any>([]);

  const recordedData = useContext(RecordedDataContext);

  const storeHeatState = (figure: any) => {
    setHeatData(figure.data);
    setHeatConfig(figure.config);
    setHeatLayout(figure.layout);
    setHeatFrames(figure.frames);
  };

  const storeBarXState = (figure: any) => {
    setBarXData(figure.data);
    setBarXConfig(figure.config);
    setBarXLayout(figure.layout);
    setBarXFrames(figure.frames);
  };

  const storeBarYState = (figure: any) => {
    setBarYData(figure.data);
    setBarYConfig(figure.config);
    setBarYLayout(figure.layout);
    setBarYFrames(figure.frames);
  };

  const renderPlot = () => {
    computePlot(playbackData.data[frameIndex]);

    if (heatZ === undefined || barX === undefined || barY === undefined) {
      return;
    }

    setHeatLayout({
      width: heatWidth,
      height: heatHeight,
      margin: {
        l: heatLMargin,
        r: heatRMargin,
        t: heatTMargin,
        b: heatBMargin
      },
      font: {
        color: fontColor
      },
      paper_bgcolor: paperBgColor,
      xaxis: {
        ticks: "",
        showticklabels: false
      },
      yaxis: {
        ticks: "",
        showticklabels: false
      }
    });

    setHeatData([
      {
        z: heatZ,
        zmin: heatZMin,
        zmax: heatZMax,
        type: "heatmap",
        showscale: true,
        colorscale: "Viridis",
        colorbar: {
          tickformat: "<-d",
          tickmode: "array",
          tickvals: [heatZMin, heatZMax]
        }
      }
    ]);

    setBarXLayout({
      width: barXWidth,
      height: barXHeight,
      margin: {
        l: barXLMargin,
        r: barXRMargin,
        t: barXTMargin,
        b: barXBMargin
      },
      font: {
        color: fontColor
      },
      plot_bgcolor: plotBgColor,
      paper_bgcolor: paperBgColor,
      xaxis: {
        mirror: true,
        showline: true,
        showgrid: false,
        ticks: "",
        tickformat: ">-d",
        tickmode: "array",
        tickvals: [],
        linecolor: axisLineColor
      },
      yaxis: {
        mirror: true,
        showline: true,
        showgrid: false,
        ticks: "",
        tickformat: ">-d",
        tickmode: "array",
        tickvals: [barXMin, barXMax],
        range: [barXMin, barXMax],
        linecolor: axisLineColor,
        zerolinecolor: axisLineColor
      }
    });

    setBarXData([
      {
        y: barX,
        type: "bar",
        width: 0.5
      }
    ]);

    setBarYLayout({
      width: barYWidth,
      height: barYHeight,
      margin: {
        l: barYLMargin,
        r: barYRMargin,
        t: barYTMargin,
        b: barYBMargin
      },
      font: {
        color: fontColor
      },
      plot_bgcolor: plotBgColor,
      paper_bgcolor: paperBgColor,
      xaxis: {
        side: "top",
        mirror: true,
        showline: true,
        showgrid: false,
        ticks: "",
        tickformat: ">-d",
        tickmode: "array",
        tickvals: [barYMin, barYMax],
        range: [barYMin, barYMax],
        linecolor: axisLineColor,
        zerolinecolor: axisLineColor
      },
      yaxis: {
        mirror: true,
        showline: true,
        showgrid: false,
        ticks: "",
        tickformat: ">-d",
        tickmode: "array",
        tickvals: [],
        linecolor: axisLineColor
      }
    });

    setBarYData([
      {
        x: barY,
        type: "bar",
        width: 0.5
      }
    ]);
  };

  const animatePlot = () => {
    requestID = requestAnimationFrame(animatePlot);

    renderPlot();

    if (run) {
      if (frameIndex + 1 >= numFrames) {
        progressIndex = 0;
        props.setRun(false);
      } else {
        frameIndex++;
        progressIndex = frameIndex;
      }
    }
  };

  useEffect(() => {
    fontColor = props.fontColor;
  }, [props.fontColor]);

  useEffect(() => {
    if (props.run && frameIndex + 1 === playbackData.data.length) {
      frameIndex = 0;
      progressIndex = frameIndex;
    }
    run = props.run;
  }, [props.run]);

  useEffect(() => {
    const initialize = () => {
      numRows = props.numRows;
      numCols = props.numCols;

      heatPlotHeight = Math.floor((HEAT_PLOT_WIDTH * numRows) / numCols);

      barYHeight = heatPlotHeight + barYTMargin + barYBMargin;
      barYWidth = BAR_PLOT_HEIGHT + barYLMargin + barYRMargin;

      heatWidth = heatPlotWidth + heatLMargin + heatRMargin;
      heatHeight = heatPlotHeight + heatTMargin + heatBMargin;

      barXHeight = BAR_PLOT_HEIGHT + barXTMargin + barXBMargin;
      barXWidth = heatPlotWidth + barXLMargin + barXRMargin;

      plotWidth = barYWidth + heatWidth;
      plotHeight = heatHeight + barXHeight;

      setHeatConfig(plotConfig);
      setBarXConfig(plotConfig);
      setBarYConfig(plotConfig);

      fontColor = props.fontColor;

      playbackData = recordedData;
      numFrames = playbackData.data.length;
      requestID = requestAnimationFrame(animatePlot);

      setInitialized(true);
    };

    if (!initialized) {
      initialize();
    } else {
      stopAnimation();
      delay(100).then(() => {
        playbackData = recordedData;
        numFrames = playbackData.data.length;
        frameIndex = 0;
        progressIndex = frameIndex;
        props.setRun(false);
        props.doSync();
        requestID = requestAnimationFrame(animatePlot);
      });
    }

    return () => {
      stopAnimation();
      frameIndex = 0;
      progressIndex = frameIndex;
    };
  }, [recordedData]);

  return initialized ? (
    <div
      style={{
        width: plotWidth + "px",
        height: plotHeight + "px",
        display: "flex",
        alignItems: "center"
      }}
    >
      <div>
        <div style={{ display: "flex", flexWrap: "nowrap" }}>
          <Plot
            data={barYData}
            config={barYConfig}
            layout={barYLayout}
            frames={barYFrames}
            onInitialized={(figure) => storeBarYState(figure)}
            onUpdate={(figure) => storeBarYState(figure)}
          />
          <Plot
            data={heatData}
            config={heatConfig}
            layout={heatLayout}
            frames={heatFrames}
            onInitialized={(figure) => storeHeatState(figure)}
            onUpdate={(figure) => storeHeatState(figure)}
          />
        </div>
        <Plot
          data={barXData}
          config={barXConfig}
          layout={barXLayout}
          frames={barXFrames}
          onInitialized={(figure) => storeBarXState(figure)}
          onUpdate={(figure) => storeBarXState(figure)}
        />
      </div>
    </div>
  ) : null;
};

export const PlaybackSlider = (props: any): JSX.Element => {
  const [index, setIndex] = useState<number>(frameIndex + 1);

  const changeIndex = (event: any) => {
    if (index !== event.target.value) {
      frameIndex = event.target.value - 1;
      progressIndex = frameIndex;
      setIndex(event.target.value);
    }
  };

  useEffect(() => {
    setIndex(frameIndex + 1);
  }, [props.sync]);

  return (
    <Slider
      value={index}
      min={1}
      max={numFrames}
      valueLabelDisplay="auto"
      onChange={changeIndex}
    />
  );
};

export const PlaybackProgress = (props: any): JSX.Element => {
  const [progress, setProgress] = useState<number>(
    Math.ceil((progressIndex * 100) / numFrames)
  );

  useEffect(() => {
    const animateProgress = () => {
      progressRequestID = requestAnimationFrame(animateProgress);
      setProgress(Math.ceil((progressIndex * 100) / numFrames));
    };
    progressRequestID = requestAnimationFrame(animateProgress);
    return () => {
      stopProgressAnimation();
    };
  }, []);

  return <LinearProgress variant="determinate" value={progress} />;
};

export default PlaybackPlot;
