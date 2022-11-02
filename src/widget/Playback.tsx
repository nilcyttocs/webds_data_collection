import React, { useState } from "react";

import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { styled } from "@mui/material/styles";

import { Page, selectFile } from "./DataCollectionComponent";

import PlaybackPlot, { PlaybackProgress, PlaybackSlider } from "./PlaybackPlot";

import { Canvas } from "./mui_extensions/Canvas";
import { Content } from "./mui_extensions/Content";
import { Controls } from "./mui_extensions/Controls";

const Input = styled("input")({
  display: "none"
});

export const Playback = (props: any): JSX.Element => {
  const [run, setRun] = useState<boolean>(false);
  const [sync, setSync] = useState<boolean>(false);

  const doSync = () => {
    setSync((prev) => !prev);
  };

  const handleBackButtonClick = () => {
    props.changePage(Page.Landing);
  };

  const handleSelectButtonClick = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const data = await selectFile(event);
      props.setRecordedData(data);
    } catch {
      return;
    }
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
        <PlaybackPlot
          run={run}
          setRun={setRun}
          numCols={props.numCols}
          numRows={props.numRows}
          doSync={doSync}
        />
      </Content>
      <Controls
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div style={{ width: "100%" }}>
          <Stack spacing={3} direction="row">
            {run === false ? (
              <Fab
                onClick={() => {
                  setRun(true);
                }}
              >
                <PlayArrowIcon />
              </Fab>
            ) : (
              <Fab
                onClick={() => {
                  setRun(false);
                }}
              >
                <PauseIcon />
              </Fab>
            )}
            {run ? (
              <div style={{ width: "100%", paddingTop: "18px" }}>
                <PlaybackProgress sync={sync} />
              </div>
            ) : (
              <div style={{ width: "100%", paddingTop: "5px" }}>
                <PlaybackSlider sync={sync} />
              </div>
            )}
          </Stack>
        </div>
        <Stack spacing={2} direction="row" sx={{ marginTop: "24px" }}>
          <Button onClick={handleBackButtonClick} sx={{ width: "150px" }}>
            Back
          </Button>
          {selectFile && (
            <label
              htmlFor="webds_heatmap_select_file_input"
              style={{ display: "flex" }}
            >
              <Input
                id="webds_heatmap_select_file_input"
                type="file"
                accept=".json"
                onChange={handleSelectButtonClick}
              />
              <Button component="span" sx={{ width: "150px" }}>
                Select
              </Button>
            </label>
          )}
        </Stack>
      </Controls>
    </Canvas>
  );
};

export default Playback;
