import { getFilledPath } from "utils";

const paper = window["paper"];

export function AddTool(app) {
  const helper = new paper.Path.Circle({
    radius: 10,
    strokeWidth: 1.0,
    strokeColor: "black",
  });
  let path = null;
  app.receiveSubHelper(helper);
  const mousemove = (e) => {
    helper.position = e.point;
  };
  const mousedown = (e) => {
    document.body.style.cursor = "none";
  };
  const mousedrag = (e) => {
    helper.position = e.point;
    if (e.count === 0) {
      path = new paper.Path({
        strokeColor: "red",
        strokeWidth: 20,
        strokeCap: "round",
        strokeJoin: "round",
        closed: false,
      });
      path.strokeColor.alpha = 0.5;
    }
    path.add(e.point);
  };
  const mouseup = () => {
    document.body.style.cursor = "auto";
    if (path) {
      if (app.selected) {
        const _id = app.selected.pathItem.id;
        const { needAddPath, deleteShape } = getFilledPath(path, app);
        // 填充mask
        app.receivePathDataAndFillMask(needAddPath.pathData);
        const cloneSelected = app.selected.pathItem.clone();
        app.selected.pathItem.remove();
        const newPath = cloneSelected.unite(deleteShape);
        // 更新pathItem
        app.updatePathItem(_id, newPath);
        // 扩充小图
        app.selected.pathItem = newPath;
        // 删除复制体
        cloneSelected.remove();
      }
      path.remove();
      path = null;
    }
  };
  return {
    mousemove,
    mousedown,
    mousedrag,
    mouseup,
  };
}
