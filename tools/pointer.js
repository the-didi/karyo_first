const paper = window["paper"];
import { resetOthers } from "utils";

export function PointerTool(app) {
  let items = [];
  const mousemove = (e) => {
    // 将items里面的内容都还原
    items.forEach((element) => {
      if (!app.selected) {
        element.fillColor = "gray";
        element.fillColor.alpha = 0.01;
      } else if (app.selected && app.selected.pathItem.id !== element.id) {
        element.fillColor = "gray";
        element.fillColor.alpha = 0.01;
      } else {
      }
    });
    const result = app.paperProject.hitTestAll(e.point);
    const ids = app.reflectLabels.map((ele) => ele.pathItem.id);
    // // 将当前被选中的元素找到
    items = [];
    result.forEach((element) => {
      if (ids.includes(element.item.id)) {
        element.item.fillColor = element.item.strokeColor;
        items.push(element.item);
      }
    });
  };
  const mousedown = () => {
    // 如果说有选中元素,那么就更新选中元素
    if (items.length > 0) {
      let minItem = items[0];
      items.forEach(
        (ele) => (minItem = ele.area > minItem.area ? ele : minItem)
      );
      app.receiveCurrentSelected(minItem);
      resetOthers(app.reflectLabels, minItem.id);
    } else {
      app.selected = null;
      resetOthers(app.reflectLabels, -1);
    }
  };
  const mousedrag = (event) => {
    const pan_offset = event.point.subtract(event.downPoint);
    app.paperView.center = app.paperView.center.subtract(pan_offset);
    const matrix = app.paperView.matrix;
    const viewPort = {
      x: -(matrix.tx / matrix.a),
      y: -(matrix.ty / matrix.a),
      width: app.paperView.bounds.width,
      height: app.paperView.bounds.height,
    };
    if (viewPort.y < 0) {
      app.paperView.matrix = matrix.translate(new paper.Point(0, viewPort.y));
    }
    if (viewPort.y + viewPort.height > app.limitInitBounds.height) {
      app.paperView.matrix = matrix.translate(
        new paper.Point(
          0,
          viewPort.y + viewPort.height - app.limitInitBounds.height
        )
      );
    }
    if (viewPort.x + viewPort.width > app.limitInitBounds.width) {
      app.paperView.matrix = matrix.translate(
        new paper.Point(
          viewPort.x + viewPort.width - app.limitInitBounds.width,
          0
        )
      );
    }
    if (viewPort.x < 0) {
      app.paperView.matrix = matrix.translate(new paper.Point(viewPort.x, 0));
    }
  };
  const mouseup = () => {};
  return {
    mousemove,
    mousedown,
    mousedrag,
    mouseup,
  };
}
