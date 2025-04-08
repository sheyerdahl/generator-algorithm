import Robot from "@hurdlegroup/robotjs";
import readline from "readline";
import Queue from "./queue.js";

// CONFIG:
const cellBackgroundColor = "0a0a0a";
const defaultGridWidth = 6; // ORIGINAL: 6
const defaultGridHeight = 6; // ORIGINAL: 6

const topLeftPosition = {x: 0, y: 0};
const bottomRightPosition = {x: 0, y: 0};
const algorithmConfig = {
    mouseMoveDelayMs: 100,
    gridWidth: defaultGridWidth,
    gridHeight: defaultGridHeight
    // nodeStartDelayMs: 100,
};

const grid = [];
const nodePathsArray = {}; // [string]: {x: number, y: number}[]
const nodeStartPositions = {}; // [string]: {x: number, y: number}
const nodeEndPositions = {}; // [string]: {x: number, y: number}
let currentlySolving = false;

// const benchmarksChooseBestNodePath = [
//     0,
//     0,
//     0,
//     0,
// ];
// let benchmarksChooseBestNodePathCount = 0;

const useFakeGrid = false;
// const fakeGridNodes = { // 3x3
//     [0]: "00ff00",
//     [8]: "00ff00",
// }
// const fakeGridNodes = { // 4x4
//     [0]: "00ff00",
//     [15]: "00ff00",
// }
// const fakeGridNodes = { // 5x5
//     [0]: "00ff00",
//     [24]: "00ff00",
// }
const fakeGridNodes = { // 6x6
    [0]: "00ff00",
    [35]: "00ff00",
}
// const fakeGridNodes = { // 6x6 close
//     [0]: "00ff00",
//     [3]: "00ff00",
// }

// setInterval(() => {
//     const mousePos = Robot.getMousePos();
//     const pixelColor = Robot.getPixelColor(mousePos.x, mousePos.y);
//     const pixelRGB = HexToRGB(pixelColor);
//     console.log("Mouse Position:", mousePos, pixelRGB);
// }, 1000);

// Main logic:
//StartSolving();

async function SolveInterval(intervalDelayMs) {
    let response = undefined;
    while (response !== "Node Positions Invalid") {
        response = await SolveOnce();
        await wait(intervalDelayMs);
    }
}

async function SolveOnce() {
    if (currentlySolving) {return;}
    currentlySolving = true;
    await InitGrid();
    if (!AreNodePositionsValid()) {
        console.log("Node positions are not valid. Exiting...");
        currentlySolving = false;
        return "Node Positions Invalid";
    }
    // 1. Connect all neighboring nodes
    PathAllNeighboringNodes();
    // 2. Breadth first search for all nodes, include total neighboring open cells, total neighboring borders, and intersecting node paths
    // 2.5. Keep all breadth first search results
    // 3. Process all paths shortest to longest, if shortest path is blocked, use the next longest path that isn't blocked
    // 3.5. Cancel an intersecting path if it's in the way?
    const nodeAllPathsArray = {}; // [string]: path[]
    for (let [node, nodePosition] of Object.entries(nodeStartPositions)) {
        const endNodePosition = nodeEndPositions[node];
        //console.log("nodeEndPositions: ", nodeEndPositions, "nodeStartPositions: ", nodeStartPositions, node);
        const endNodeCell = GetCell(endNodePosition.x, endNodePosition.y);
        if (endNodeCell.Path !== "") {continue;}

        const startingCellIndex = CellPositionToGridIndex(nodePosition);
        const endingCellIndex = CellPositionToGridIndex(endNodePosition);
        console.log("Getting paths of node: ", node);
        console.log("Starting cell index:", startingCellIndex, "Ending cell index:", endingCellIndex);
        console.time("GetAllPaths");
        const nodePaths = GetAllPaths(startingCellIndex, endingCellIndex);
        console.timeEnd("GetAllPaths");
        nodeAllPathsArray[node] = nodePaths;
        //console.log("Node:", node, "NodePaths:", nodePaths);
        console.log("Length:", nodePaths.length);
        //console.log("Path length:", pathLength, "In order:", inOrder);
    }

    console.log("Starting to process paths...");
    console.time("ProcessPaths");
    let timePassedNs = 0;
    const maxTimeNs = 5e9; // 1e9 = second
    // const benchmarks = [
    //     0,
    //     0,
    //     0,
    //     0,
    // ];

    const nodePathsToProcess = {...nodeAllPathsArray}; // [string]: path[]
    const blacklistedPaths = new Map(); // [path]: boolean // TODO: use WeakMap instead of Map?
    while (Object.keys(nodePathsToProcess).length > 0) {
        if (timePassedNs > maxTimeNs) {break;}
        const timeElapsedStart = process.hrtime(); // BENCHMARKING

        // const [node, nodePaths] = Object.entries(nodePathsToProcess).pop();
        const nodePathsToProcessEntries = Object.entries(nodePathsToProcess);
        const [node, nodePaths] = nodePathsToProcessEntries[Math.floor(Math.random()*nodePathsToProcessEntries.length)]; // Choose a random node paths to process
        delete nodePathsToProcess[node];

        if (nodePaths.length === 0) {continue;}

        // let allPathsAreBlacklisted = true;
        // for (let i = 0; i < nodePaths.length; i++) {
        //     const pathData = nodePaths[i];
        //     const isPathBlacklisted = blacklistedPaths.get(pathData) ? true : false;
        //     if (!isPathBlacklisted) {
        //         allPathsAreBlacklisted = false;
        //         break;
        //     }
        // }
        // if (allPathsAreBlacklisted) {
        //     console.log("All paths are blacklisted for node: ", node);
        //     continue;
        // }

        //const bench1Start = process.hrtime(); // BENCHMARKING
        let bestNodePath = ChooseBestNodePath(nodePaths, blacklistedPaths);
        //const bench1End = process.hrtime(bench1Start); // BENCHMARKING
        //benchmarks[1] += bench1End[1];
        // Remove blocking paths and reprocess the node later
        //const bench2Start = process.hrtime(); // BENCHMARKING
        while (bestNodePath.blockingNode !== "") {
            const blockingNode = bestNodePath.blockingNode;
            RemoveNodePaths(blockingNode);
            nodePathsToProcess[blockingNode] = nodeAllPathsArray[blockingNode];
            // blacklistedPaths.set(bestNodePath.chosenPathData, true);
            bestNodePath = ChooseBestNodePath(nodePaths, blacklistedPaths);
            blacklistedPaths.set(bestNodePath.chosenPathData, true);
        }
        //const bench2End = process.hrtime(bench2Start); // BENCHMARKING
        //benchmarks[2] += bench2End[1];
        
        const chosenPathData = bestNodePath.chosenPathData;
        for (let i = 0; i < chosenPathData.cellIndices.length; i++) {
            const cellIndex = chosenPathData.cellIndices[i];
            const cellPosition = GridIndexToCellPosition(cellIndex);
            AddPath(cellPosition.x, cellPosition.y, node);
        }

        const timeElapsedEnd = process.hrtime(timeElapsedStart); // BENCHMARKING
        timePassedNs += timeElapsedEnd[1];
    }
    console.timeEnd("ProcessPaths");

    // benchmarks.forEach((benchmark, index) => {
    //     console.log(`Benchmarks ${index}: `, "ns:", benchmark, "ms:", benchmark / 1e6, "s:", benchmark / 1e9);
    // });
    // console.log("benchmarksChooseBestNodePath:");
    // benchmarksChooseBestNodePath.forEach((benchmark, index) => {
    //     console.log(`Benchmarks ${index}: `, "ns:", benchmark, "ms:", benchmark / 1e6, "s:", benchmark / 1e9);
    // });
    // console.log("benchmarksChooseBestNodePathCount:", benchmarksChooseBestNodePathCount);
    //return;
    // 4. Trace mouse along paths and click on each node
    for (let [node, nodePosition] of Object.entries(nodeStartPositions)) {
        const nodePaths = nodePathsArray[node];

        //await wait(algorithmConfig.nodeStartDelayMs);
        StartMousePath(nodePosition.x, nodePosition.y);
        for (let nodePathIndex = 0; nodePathIndex < nodePaths.length; nodePathIndex++) {
            const pathPosition = nodePaths[nodePathIndex];
            if (algorithmConfig.mouseMoveDelayMs > 1) {
                await wait(algorithmConfig.mouseMoveDelayMs);
            }
            MoveMousePath(pathPosition.x, pathPosition.y);
        }
        EndMousePath();
    }
    currentlySolving = false;
}

// Algorithm functions:
function PathAllNeighboringNodes() {
    for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];
        const {x, y} = cell.Position;

        if (cell.Node === "") {continue;}
        if (nodeStartPositions[cell.Node].x !== x || nodeStartPositions[cell.Node].y !== y) {continue;} // Only process on the first node
        
        const neighbors = GetCellNeighbors(x, y);
        for (let [directionName, neighborData] of Object.entries(neighbors)) {
            const neighborCell = neighborData[1];
            const directionPosition = neighborData[0];
            if (neighborCell === undefined || neighborCell.Node !== cell.Node) {continue;}

            AddPath(x + directionPosition.x, y + directionPosition.y, cell.Node);
        }
    }
}

// Iterative breadth-first search algorithm that stores all paths
// type path = {totalNeighbors: number, totalBorders: number, cellIndices: number[]}
// Don't add the previously visited cell to cellQueue, this still allows infinite cycles, so also put a max limit on the amount of paths a cell can hold.
// When visiting a cell, deep copy the previous path and add the current cell to it. Then add that new path to cellPathsArray[current cell].
// After the loop is done (maybe a set amount of iterations?), return the cellPathsArray[endCellIndex].
// possibly make sure cellPathsArray is garbage collected??
function GetAllPaths(startCellIndex, endCellIndex) {
    const cellPathsArray = []; // path[cellIndex][pathIndex]
    // const movementQueue = []; // {newCellIndex: number, lastCellIndex: number, lastPathIndex: number}[]
    const movementQueue = new Queue(); // {newCellIndex: number, lastCellIndex: number, lastPathIndex: number}[]
    const cellPathsLimit = 150;
    // const cellPathsLimit = 1e9;

    for (let i = 0; i < grid.length; i++) { // Init cellPathsArray
        cellPathsArray[i] = [];
    }

    movementQueue.push({
        newCellIndex: startCellIndex,
        lastCellIndex: -1,
        lastPathIndex: -1,
    });

    // const benchmarks = [
    //     0,
    //     0,
    //     0,
    //     0,
    // ];

    while (movementQueue.getLength() > 0) {
        // const bench0Start = process.hrtime(); // BENCHMARKING
        const movementData = movementQueue.shift();
        // const bench0End = process.hrtime(bench0Start); // BENCHMARKING
        //benchmarks[0] += bench0End[1];
        const currentCellIndex = movementData.newCellIndex;
        const lastCellIndex = movementData.lastCellIndex;
        const lastPathIndex = movementData.lastPathIndex;
        const cellPosition = GridIndexToCellPosition(currentCellIndex);
        
        //const bench1Start = process.hrtime(); // BENCHMARKING
        const lastPathExists = cellPathsArray[lastCellIndex] !== undefined && cellPathsArray[lastCellIndex][lastPathIndex] !== undefined;
        const oldPath = lastPathExists ? cellPathsArray[lastCellIndex][lastPathIndex] : undefined;
        const newPath = lastPathExists ? {totalNeighbors: oldPath.totalNeighbors, totalBorders: oldPath.totalBorders, cellIndices: [...oldPath.cellIndices]} : {totalNeighbors: 0, totalBorders: 0, cellIndices: []};
        newPath.cellIndices.push(currentCellIndex);
        cellPathsArray[currentCellIndex].push(newPath);
        const newPathIndex = cellPathsArray[currentCellIndex].length - 1;
        // const bench1End = process.hrtime(bench1Start); // BENCHMARKING
        // benchmarks[1] += bench1End[1];

        
        if (currentCellIndex === endCellIndex) {
            // At the end cell
            // currentPath.FoundEndCell = true;
            continue;
        }
        //const bench3Start = process.hrtime(); // BENCHMARKING
        const neighbors = GetCellNeighbors(cellPosition.x, cellPosition.y);
        for (let [directionName, neighborData] of Object.entries(neighbors)) {
            const neighborCell = neighborData[1];
            const directionPosition = neighborData[0];

            if (neighborCell === undefined) {
                newPath.totalBorders += 1;
                continue;
            } // Possibly also check (neighborCell.Path)?

            const neighborCellIndex = CellPositionToGridIndex(neighborCell.Position);
            const backtracking = newPath.cellIndices.indexOf(neighborCellIndex) !== -1;
            const neighborHasNode = neighborCell.Node !== "";
            const neighborNodeIsEndNode = neighborCell.Node === grid[startCellIndex].Node;
            
            if (neighborCellIndex === lastCellIndex || backtracking || (neighborHasNode && !neighborNodeIsEndNode) || cellPathsArray[neighborCellIndex].length >= cellPathsLimit) {continue;}
            // nodePaths[cell.Node].push({x: x + directionPosition.x, y: y + directionPosition.y});
            if (!neighborHasNode) {
                newPath.totalNeighbors += 1;
            }
            movementQueue.push({
                newCellIndex: neighborCellIndex,
                lastCellIndex: currentCellIndex,
                lastPathIndex: newPathIndex,
            });
        }
        // const bench3End = process.hrtime(bench3Start); // BENCHMARKING
        // benchmarks[3] += bench3End[1];
    }
    // benchmarks.forEach((benchmark, index) => {
    //     console.log(`Benchmarks ${index}: `, "ns:", benchmark, "ms:", benchmark / 1e6, "s:", benchmark / 1e9);
    // });
    //console.log("cellPathsArray:", cellPathsArray);
    return cellPathsArray[endCellIndex];
}

function GetBlockingNodePath(pathData) {
    const cellIndices = pathData.cellIndices;
    for (let i = 0; i < cellIndices.length; i++) {
        const cellIndex = cellIndices[i];
        const cell = grid[cellIndex];
        if (cell.Path !== "") {
            return cell.Path;
        }
    }

    return "";
}

function ChooseBestNodePath(nodePaths, blacklistedPaths) {
    let pathLength = nodePaths[0].cellIndices.length;
    let chosenPathData = nodePaths[0];
    let blockingNode = GetBlockingNodePath(chosenPathData);
    let pathIsBlacklisted = blacklistedPaths.get(chosenPathData) ? true : false;
    // TODO: if path is blocked by a real path in nodePathsArray, then skip it. If all paths are skipped, possibly remove that path, then restart going through the paths. Then go through the paths of the node that path got removed
    for (let i = 0; i < nodePaths.length; i++) {
        //benchmarksChooseBestNodePathCount++;
        //const bench1Start = process.hrtime(); // BENCHMARKING
        const pathData = nodePaths[i];
        const isPathBlacklisted = blacklistedPaths.get(pathData);
        //const bench1End = process.hrtime(bench1Start); // BENCHMARKING
        //benchmarksChooseBestNodePath[1] += bench1End[1];
        if (isPathBlacklisted) {
            //console.log("Blocked path: ", pathData);
            continue;
        }

        const cellIndicesLength = pathData.cellIndices.length;
        const pathHasLessNeighbors = pathData.totalNeighbors < chosenPathData.totalNeighbors;
        const pathHasLessBorders = pathData.totalBorders <= chosenPathData.totalBorders;

        if (blockingNode === "" && cellIndicesLength > pathLength) {break;}
       // const bench2Start = process.hrtime(); // BENCHMARKING
        const replaceBlockedPath = blockingNode !== "" && GetBlockingNodePath(pathData) === "";
        //const bench2End = process.hrtime(bench2Start); // BENCHMARKING
        //benchmarksChooseBestNodePath[2] += bench2End[1];
        if (pathIsBlacklisted || replaceBlockedPath || (pathHasLessNeighbors && (pathHasLessNeighbors && pathHasLessBorders) && GetBlockingNodePath(pathData) === "")) {
            chosenPathData = pathData;
            blockingNode = GetBlockingNodePath(pathData);
            pathIsBlacklisted = false;
        }
    }

    return {chosenPathData, blockingNode, pathIsBlacklisted};
}

// Logic functions:
async function InitGrid() {
    ClearGridVariables();
    for (let y = 0; y < algorithmConfig.gridHeight; y++) {
        for (let x = 0; x < algorithmConfig.gridWidth; x++) {
            const cell = {
                Position: {x, y},
                Node: "",
                Path: "",
            };
            grid.push(cell);
        }
    }

    for (let x = 0; x < algorithmConfig.gridWidth; x++) {
        for (let y = 0; y < algorithmConfig.gridHeight; y++) {
            const pixelPosition = GetCellPixelPosition(x, y);
            //Robot.moveMouseSmooth(pixelPosition.x, pixelPosition.y, 0);
            //await wait(500);
            const pixelColor = useFakeGrid ? fakeGridNodes[CellPositionToGridIndex({x, y})] : Robot.getPixelColor(pixelPosition.x, pixelPosition.y);
            const cell = GetCell(x, y);
            //console.log(pixelPosition, x, y, HexToRGB(pixelColor));
            if (pixelColor === cellBackgroundColor || pixelColor === undefined) {continue;}
            cell.Node = pixelColor;
            if (nodeStartPositions[pixelColor] !== undefined) {
                nodeEndPositions[pixelColor] = {x, y};
            }
            nodeStartPositions[pixelColor] = nodeStartPositions[pixelColor] || {x, y}; // Initialize if not already
            nodePathsArray[pixelColor] = nodePathsArray[pixelColor] || []; // Initialize if not already
        }
    }
    // console.log("grid: ", grid);
    // console.log("nodeStartPositions: ", nodeStartPositions);
    // console.log("nodeEndPositions: ", nodeEndPositions);
    // console.log("nodePathsArray: ", nodePathsArray);
}

function AreNodePositionsValid() {
    const nodeStartPositionsKeys = Object.keys(nodeStartPositions);
    for (let i = 0; i < nodeStartPositionsKeys.length; i++) {
        const key = nodeStartPositionsKeys[i];
        if (nodeEndPositions[key] === undefined) {
            return false;
        }
    }

    const nodeEndPositionsKeys = Object.keys(nodeEndPositions);
    for (let i = 0; i < nodeEndPositionsKeys.length; i++) {
        const key = nodeEndPositionsKeys[i];
        if (nodeStartPositions[key] === undefined) {
            return false;
        }
    }

    return true;
}

function ClearGridVariables() {
    grid.splice(0, grid.length)
    Object.keys(nodePathsArray).forEach(key => delete nodePathsArray[key]);
    Object.keys(nodeStartPositions).forEach(key => delete nodeStartPositions[key]);
    Object.keys(nodeEndPositions).forEach(key => delete nodeEndPositions[key]);
}

// Helper functions:
function RemoveNodePaths(node) {
    const nodePaths = nodePathsArray[node];
    for (let i = 0; i < nodePaths.length; i++) {
        const pathPosition = nodePaths[i];
        const cell = GetCell(pathPosition.x, pathPosition.y);
        cell.Path = "";
    }
    nodePaths.splice(0, nodePaths.length) // Empty the array
}

function StartMousePath(x, y) {
    MoveMousePath(x, y);
    Robot.mouseToggle("down");
}

function MoveMousePath(x, y) {
    const pixelPosition = GetCellPixelPosition(x, y);
    //const cell = GetCell(x, y);
    Robot.moveMouseSmooth(pixelPosition.x, pixelPosition.y, 0);
    //cell.Path = nodeColor;
}

function EndMousePath() {
    Robot.mouseToggle("up");
}

function AddPath(x, y, node) {
    const cell = GetCell(x, y);
    nodePathsArray[node].push({x, y});
    cell.Path = node;
}

function GetCell(x, y) {
    if (x < 0 || x >= algorithmConfig.gridWidth || y < 0 || y >= algorithmConfig.gridHeight) {
        return undefined;
    }

    return grid[x + (y * algorithmConfig.gridWidth)];
}

function GridIndexToCellPosition(index) {
    const x = index % algorithmConfig.gridWidth;
    const y = Math.floor(index / algorithmConfig.gridWidth);
    return {x, y};
}

function CellPositionToGridIndex(position) {
    return position.x + (position.y * algorithmConfig.gridWidth);
}

function GetCellPixelPosition(x, y) {
    const cellWidth = Math.floor((bottomRightPosition.x - topLeftPosition.x) / algorithmConfig.gridWidth);
    const cellHeight = Math.floor((bottomRightPosition.y - topLeftPosition.y) / algorithmConfig.gridHeight);

    return {
        x: topLeftPosition.x + (cellWidth * x) + (cellWidth / 2),
        y: topLeftPosition.y + (cellHeight * y) + (cellHeight / 3),
    };
}

function HexToRGB(hex) {
    return {
        r: Number("0x" + hex[0] + hex[1]),
        g: Number("0x" + hex[2] + hex[3]),
        b: Number("0x" + hex[4] + hex[5]),
    };
}

function GetCellNeighbors(x, y) {
    const neighbors = {};

    neighbors["Left"] = [{x: -1, y: 0}, GetCell(x - 1, y)]; // left
    neighbors["Right"] = [{x: 1, y: 0}, GetCell(x + 1, y)]; // right
    neighbors["Up"] = [{x: 0, y: -1}, GetCell(x, y - 1)]; // up
    neighbors["Down"] = [{x: 0, y: 1}, GetCell(x, y + 1)]; // down

    return neighbors;
}

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
        resolve();
        }, ms);
    });
}

// 216 or 220 for white border?
// 0 for black border?
export {
    SolveOnce,
    SolveInterval,
    topLeftPosition,
    bottomRightPosition,
    algorithmConfig,
}