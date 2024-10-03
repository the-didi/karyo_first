import {
  wrapperPathData,
  generatorPathByLabel,
  getPointsByCurves,
} from "utils";
const paper = window["paper"];
export function SplitTool(app) {
  let path = null;
  const mousemove = () => {};
  const mousedown = () => {};
  const mousedrag = (e) => {
    if (e.count === 0) {
      path = new paper.Path({
        strokeColor: "blue",
        strokeWidth: 1,
        closed: false,
      });
    }
    path.add(e.point);
  };
  const mouseup = (e) => {
    if (app.selected && path) {
      if (app.selected.pathItem.contains(e.point)) {
        path.remove();
        return;
      }
      // 先在mask上进行操作
      const pathData = wrapperPathData(path, app);
      app.receiveSplitPathDataAndFillWhite(pathData).then((res) => {
        const topLeft = app.mask.bounds.topLeft;
        const segments = generatorPathByLabel(app.selected.label, app);
        let pathList = [];
        for (const segment of segments) {
          const newPoints = segment.map((point) => [
            point[0] * app.params.scaleValueX + topLeft.x,
            point[1] * app.params.scaleValueY + topLeft.y,
          ]);
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
      });
    }
    path.remove();
  };
  return {
    mousemove,
    mousedown,
    mousedrag,
    mouseup,
  };
}
