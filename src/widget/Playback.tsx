import React, { useContext, useState } from "react";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import PauseCircleIcon from "@mui/icons-material/PauseCircle";

import ADCPlayback from "./adc_plots/ADCPlayback";
import PlaybackProgress from "./playback_controls/PlaybackProgress";
import PlaybackSlider from "./playback_controls/PlaybackSlider";
import PlaybackSpeed from "./playback_controls/PlaybackSpeed";

import { Page } from "./DataCollectionComponent";

import { Canvas } from "./mui_extensions/Canvas";
import { Content } from "./mui_extensions/Content";
import { Controls } from "./mui_extensions/Controls";

import { ADCDataContext } from "./local_exports";

export const Playback = (props: any): JSX.Element => {
  const [run, setRun] = useState<boolean>(false);
  const [frameIndex, setFrameIndex] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);

  const adcData = useContext(ADCDataContext);

  const handleBackButtonClick = () => {
    setRun(false);
    setTimeout(() => {
      setFrameIndex(0);
      props.changePage(Page.Landing);
    }, 1);
  };

  return (
    <Canvas title="ADC Playback">
      <Content
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {adcData.length > 0 ? (
          <ADCPlayback
            run={run}
            setRun={setRun}
            speed={playbackSpeed}
            frameIndex={frameIndex}
            setFrameIndex={setFrameIndex}
            numFrames={adcData.length}
          />
        ) : null}
      </Content>
      <Controls
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <div
            style={{
              width: "100%",
              margin: "0px 16px",
              display: "flex",
              alignItems: "center"
            }}
          >
            {run ? (
              <div style={{ width: "100%" }}>
                <PlaybackProgress
                  frameIndex={frameIndex}
                  numFrames={adcData.length}
                />
              </div>
            ) : (
              <PlaybackSlider
                frameIndex={frameIndex}
                setFrameIndex={setFrameIndex}
                numFrames={adcData.length}
                sx={{ display: "flex", alignItems: "center" }}
              />
            )}
          </div>
          <IconButton
            color="primary"
            disabled={adcData.length === 0}
            onClick={() => {
              setRun(!run);
            }}
            sx={{
              padding: "0px",
              "& .MuiSvgIcon-root": {
                fontSize: "2.5rem"
              }
            }}
          >
            {run ? <PauseCircleIcon /> : <PlayCircleIcon />}
          </IconButton>
          <IconButton
            color="primary"
            disabled={adcData.length === 0}
            onClick={() => {
              setRun(false);
              setTimeout(() => {
                setFrameIndex(0);
              }, 1);
            }}
            sx={{
              padding: "0px",
              "& .MuiSvgIcon-root": {
                fontSize: "2.5rem"
              }
            }}
          >
            <StopCircleIcon />
          </IconButton>
          <div style={{ marginLeft: "8px" }}>
            <PlaybackSpeed
              disabled={adcData.length === 0}
              setPlaybackSpeed={setPlaybackSpeed}
            />
          </div>
        </div>
        <div style={{ marginTop: "24px" }}>
          <Button onClick={handleBackButtonClick} sx={{ width: "150px" }}>
            Back
          </Button>
        </div>
      </Controls>
    </Canvas>
  );
};

export default Playback;
