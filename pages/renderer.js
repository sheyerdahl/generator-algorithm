const electronAPI = window.electronAPI;
const topLeftCornerText = document.getElementById("TopLeftCornerText");
const bottomRightCornerText = document.getElementById("BottomRightCornerText");
const mouseMoveDelayInput = document.getElementById("mouseMoveDelayInput");
const gridWidthInput = document.getElementById("gridWidthInput");
const gridHeightInput = document.getElementById("gridHeightInput");

// filePathButton.addEventListener("click", UpdateSelectedFile);

function UpdateSelectedFile() {
    const pathName = filePathInput.value;

    // console.log(pathName)
    loadingText.innerText = "Selected file is:";
    filePathText.innerText = pathName;
}

//console.log(topLeftCornerPosition);
setInterval(async () => {
    const topLeftCorner = await electronAPI.getTopLeftPosition();
    const bottomRightCorner = await electronAPI.getBottomRightPosition();
    // Update position text every 100ms
    topLeftCornerText.innerText = `${topLeftCorner.x}, ${topLeftCorner.y}`;
    bottomRightCornerText.innerText = `${bottomRightCorner.x}, ${bottomRightCorner.y}`;
}, 100);

// mouseMoveDelayInput.addEventListener("input", (event) => {
//     const value = event.target.value;
//     electronAPI.setMouseMoveDelay(value);
// });

electronAPI.setAlgorithmConfigToRenderer((newAlgorithmConfig) => {
    console.log("setAlgorithmConfigToRenderer: ", newAlgorithmConfig);
    const newMouseMoveDelay = newAlgorithmConfig.mouseMoveDelayMs;

    mouseMoveDelayInput.value = newMouseMoveDelay;
    gridWidthInput.value = newAlgorithmConfig.gridWidth;
    gridHeightInput.value = newAlgorithmConfig.gridHeight;
});

function onAlgorithmConfigChange() {
    const newAlgorithmConfig = {
        mouseMoveDelayMs: mouseMoveDelayInput.value,
        gridWidth: gridWidthInput.value,
        gridHeight: gridHeightInput.value
    };
    electronAPI.setAlgorithmConfig(newAlgorithmConfig);
}
gridWidthInput.addEventListener("input", onAlgorithmConfigChange);
gridHeightInput.addEventListener("input", onAlgorithmConfigChange);
mouseMoveDelayInput.addEventListener("input", onAlgorithmConfigChange);