const paper = window["paper"];
import {
  mergePathsWithinDistance,
  findClosestDistanceBetweenPaths,
  getPointsByCurves,
  isPathInsideAnother,
} from "utils";
export function LinkTool(app) {
  let path = null;
  let origin = null;
  let target = null;
  let targetResult = null;
  const mousemove = () => {};
  const mousedown = () => {};
  const mouseup = () => {
    const notIntersect = () => {
      const newPath = mergePathsWithinDistance(origin, target, 3);
      newPath.strokeColor = app.selected.pathItem.strokeColor;
      newPath.strokeWidth = app.selected.pathItem.strokeWidth;
      newPath.fillColor = "gray";
      newPath.fillColor.alpha = 0.01;
      return newPath;
    };
    const Intersect = () => {
      const newPath = app.selected.pathItem.unite(targetResult.item);
      newPath.strokeColor = app.selected.pathItem.strokeColor;
      newPath.strokeWidth = app.selected.pathItem.strokeWidth;
      newPath.fillColor = "gray";
      newPath.fillColor.alpha = 0.01;
      return newPath;
    };
    if (app.selected && path && target && origin) {
      let newPath = null;
      console.log(isPathInsideAnother(target, origin));
      if (target.intersects(origin) || isPathInsideAnother(target, origin)) {
        newPath = Intersect();
      } else if (findClosestDistanceBetweenPaths(target, origin) < 5) {
        newPath = notIntersect();
      }
      if (newPath === null) {
        alert("这两个染色体太远了");
        return;
      }
      // target和origin都要舍弃掉
      app.selected.pathItem.remove();
      targetResult.item.remove();
      app.reflectLabels = app.reflectLabels.filter(
        (ele) =>
          ele.pathItem.id !== targetResult.item &&
          ele.pathItem.id !== app.selected.pathItem.id
      );
      targetResult = null;
      app.reflectLabels.push({
        pathItem: newPath,
        label: {
          points: getPointsByCurves(newPath.curves, app),
        },
      });
    }
    if (path) {
      path.remove();
    }
    if (target) {
      target.remove();
    }
    if (origin) {
      origin.remove();
    }
  };
  const mousedrag = (e) => {
    if (
      e.count === 0 &&
      app.selected &&
      app.selected.pathItem.contains(e.point)
    ) {
      path = new paper.Path.Line(e.point, e.point);
      path.dashArray = [4, 4];
      path.strokeColor = "blue";
      path.strokeWidth = 2;
      origin = app.selected.pathItem.clone();
      origin.strokeColor = "blue";
      origin.dashArray = [4, 4];
    }
    if (path) {
      path.lastSegment.point = e.point;
      // 判断target
      const result = app.getIntersectItems(e.point);

      if (target) {
        target.remove();
      }
      if (result && result.id !== app.selected.pathItem.id) {
        targetResult = result;
        target = result.item.clone();
        target.strokeColor = "blue";
        target.dashArray = [4, 4];
      }
    }
  };
  return {
    mousemove,
    mousedown,
    mousedrag,
    mouseup,
  };
}
