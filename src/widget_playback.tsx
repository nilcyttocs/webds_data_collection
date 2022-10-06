import React, { useState } from "react";

import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import { styled } from "@mui/material/styles";

import { Page, selectFile } from "./widget_container";

import HeatmapPlayback, {
  HeatmapPlaybackProgress,
  HeatmapPlaybackSlider
} from "./heatmap_playback";

const showHelp = false;

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
    <>
      <Stack spacing={2}>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            height: props.dimensions.heightTitle + "px",
            position: "relative",
            bgcolor: "section.main"
          }}
        >
          <Typography
            variant="h5"
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)"
            }}
          >
            ADC Playback
          </Typography>
          {showHelp && (
            <Button
              variant="text"
              sx={{
                position: "absolute",
                top: "50%",
                left: "16px",
                transform: "translate(0%, -50%)"
              }}
            >
              <Typography variant="body2" sx={{ textDecoration: "underline" }}>
                Help
              </Typography>
            </Button>
          )}
        </Box>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            minHeight: props.dimensions.heightContent + "px",
            boxSizing: "border-box",
            padding: "24px",
            position: "relative",
            bgcolor: "section.main",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <HeatmapPlayback
            run={run}
            setRun={setRun}
            numCols={props.numCols}
            numRows={props.numRows}
            fontColor={props.fontColor}
            doSync={doSync}
          />
        </Box>
        <Box
          sx={{
            width: props.dimensions.width + "px",
            minHeight: props.dimensions.heightControls + "px",
            boxSizing: "border-box",
            padding: "24px",
            position: "relative",
            bgcolor: "section.main",
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
                  <HeatmapPlaybackProgress sync={sync} />
                </div>
              ) : (
                <div style={{ width: "100%", paddingTop: "5px" }}>
                  <HeatmapPlaybackSlider sync={sync} />
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
        </Box>
      </Stack>
    </>
  );
};
