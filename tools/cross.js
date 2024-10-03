import {
  caculateExcusive,
  convexHull,
  caculateSplitTwoChromosome,
  splitPathWithNearestPoints,
  getPointsByCurves,
} from "utils";

const paper = window["paper"];

export function CrossTool(app) {
  const helper = new paper.Path({
    strokeColor: "red",
    strokeWidth: 1,
    strokeCap: "round",
    closed: true,
  });
  helper.strokeJoin = "bevel";
  let splitPath = null;
  let nearestPoints = null;
  const mousemove = (event) => {
    helper.removeSegments();
    if (app.selected && app.selected.pathItem.contains(event.point)) {
      // 遍历pathItem的所有点，每一个点都有一条入射角和出射角向量
      nearestPoints = caculateExcusive(event.point, app.selected.pathItem);
      const convexHullPoints = convexHull(
        nearestPoints.map((ele) => ele.point)
      );
      convexHullPoints.forEach((element) => {
        helper.add(element);
      });
      // 计算helper的样式，如果说能够将pathItem分为两个染色体,那么就让他分割
      splitPath = caculateSplitTwoChromosome(app.selected.pathItem, helper);
      if (splitPath && splitPath.children && splitPath.children.length == 2) {
        helper.strokeColor = "green";
      } else {
        helper.strokeColor = "red";
      }
      splitPath.remove();
    }
  };
  const mousedown = (event) => {
    if (
      app.selected &&
      app.selected.pathItem.contains(event.point) &&
      splitPath.children.length == 2
    ) {
      const split_paths = splitPathWithNearestPoints(
        app.selected.pathItem,
        helper,
        nearestPoints
      );
      let pathList = [];
      for (const path of split_paths) {
        const newPoints = path.segments.map((segment) => segment.point);
        const currentPath = new paper.Path({
          segments: newPoints,
          strokeColor: paper.Color.random(),
          closed: true,
          strokeWidth: 0.5,
        });
        pathList.push({
          pathItem: currentPath,
          label: {
            points: getPointsByCurves(currentPath.curves, app),
          },
        });
      }
      app.replacePathItemWithPathList(pathList);
      app.selected.pathItem.remove();
      app.selected = null;
    }
    helper.remove();
  };
  return {
    mousemove,
    mousedown,
  };
}
