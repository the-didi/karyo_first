import { dataSource } from "./data.js";
import GUI from "lil-gui";
import { PointerTool } from "pointer";
import { RemoveTool } from "remove";
import { AddTool } from "add";
import { SplitTool } from "split";
import { LinkTool } from "link";
import { CrossTool } from "cross";
import { resetOthers } from "utils";

// 定义paperJS
const paper = window["paper"];

var simpleZoom = function (oldZoom, delta) {
  var factor = 1.3;
  var zoom = oldZoom;
  if (delta < 0) {
    zoom = oldZoom * factor;
  } else if (delta > 0) {
    zoom = oldZoom / factor;
  }
  return zoom;
};

var stableZoom = function (oldZoom, delta, c, p) {
  var newZoom = simpleZoom(oldZoom, delta);
  var beta = oldZoom / newZoom;
  var pc = p.subtract(c);
  var a = p.subtract(pc.multiply(beta)).subtract(c);
  return { zoom: newZoom, offset: a };
};

function generatorMask(params) {
  const canvas = document.createElement("canvas");
  canvas.width = params.originalWidth;
  canvas.height = params.originalHeight;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, params.originalWidth, params.originalHeight);
  for (const item of dataSource.oldImageLbales) {
    context.fillStyle = "black";
    context.beginPath();
    item.points.forEach((ele, index) => {
      if (index === 0) {
        context.moveTo(ele[0], ele[1]);
      } else {
        context.lineTo(ele[0], ele[1]);
      }
    });
    context.closePath();
    context.fill();
  }
  return canvas.toDataURL("image/png");
}

function generatorLineStrokeWhiteMaskByPath(maskCanvas, pathData, label) {
  // 绘制线底图
  const canvas = document.createElement("canvas");
  canvas.width = maskCanvas.width;
  canvas.height = maskCanvas.height;
  const newCtx = canvas.getContext("2d");
  // 裁剪线底图
  label.points.forEach((ele, index) => {
    if (index === 0) {
      newCtx.moveTo(ele[0], ele[1]);
    } else {
      newCtx.lineTo(ele[0], ele[1]);
    }
  });
  newCtx.clip();
  const path = new Path2D(pathData);
  newCtx.lineWidth = 2;
  newCtx.strokeStyle = "#fff";
  newCtx.beginPath();
  newCtx.stroke(path);
  // maskCanvas合并线底图
  const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
}

function generatorMaskImageDataByPath(maskCanvas, pathData) {
  const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
  // 解析路径数据
  const path = new Path2D(pathData);
  // 将解析后的路径添加到当前路径
  ctx.fillStyle = "black";
  ctx.fill(path);
  return ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
}
function subtractMaskImageDataByPath(maskCanvas, pathData) {
  const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
  // 解析路径数据
  const path = new Path2D(pathData);
  // 将解析后的路径添加到当前路径
  ctx.fillStyle = "#fff";
  ctx.fill(path);
  return ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
}

function generatorPaperGroup(topLeft, params) {
  const group = new paper.Group();
  let result = [];
  for (const label of dataSource.oldImageLbales) {
    const color = paper.Color.random();
    const path = new paper.Path({
      segments: label.points.map((point) => [
        point[0] * params.scaleValueX + topLeft.x,
        point[1] * params.scaleValueY + topLeft.y,
      ]),
      strokeColor: color,
      fillColor: "gray",
      closed: true,
      strokeWidth: 0.5,
    });
    path.fillColor.alpha = 0.01;
    group.addChild(path);
    result.push({
      label,
      pathItem: path,
    });
  }
  return {
    generatorGroup: group,
    result,
  };
}

class App {
  constructor() {
    const _that = this;
    this.dataSource = dataSource;
    this.initApp();
    this.loadImageSource().then((res) => {
      _that.initTool();
      _that.addEventListener();
      _that.initGeometry();
      _that.initGUI();
    });
  }
  receiveCurrentSelected(currentSelectedItem) {
    this.selected = this.reflectLabels.find(
      (ele) => ele.pathItem.id === currentSelectedItem.id
    );
    this.selected.pathItem.bringToFront();
  }
  receiveSplitPathDataAndFillWhite(pathData) {
    return new Promise((resolve) => {
      const imageData = generatorLineStrokeWhiteMaskByPath(
        this.mask.canvas,
        pathData,
        this.selected.label
      );
      this.mask.putImageData(imageData, 0, 0);
      resolve();
    });
  }
  receivePathDataAndFillMask(pathData) {
    const imageData = generatorMaskImageDataByPath(this.mask.canvas, pathData);
    this.mask.putImageData(imageData, 0, 0);
  }
  receivePathDataAndSubtractMask(pathData) {
    const imageData = subtractMaskImageDataByPath(this.mask.canvas, pathData);
    this.mask.putImageData(imageData, 0, 0);
  }
  getIntersectItems(point) {
    const ids = this.reflectLabels.map((ele) => ele.pathItem.id);
    const result = this.paperProject
      .hitTestAll(point)
      .filter((ele) => ids.includes(ele.item.id));
    if (result.length !== 0) {
      let maxItem = result[0];
      result.forEach((ele) => (ele.area > maxItem.area ? ele : maxItem));
      return maxItem;
    }
    return null;
  }
  initGeometry() {
    const _that = this;
    // 绘制mask
    const maskCanvas = generatorMask(this.params);
    this.mask = new paper.Raster(maskCanvas);
    this.mask.onLoad = () => {
      _that.mask.fitBounds(_that.paperView.bounds, false);
      _that.mask.visible = this.params.showMask;
      _that.resizeGroup.addChild(_that.mask);
    };
    // 绘制线
    const { generatorGroup, result } = generatorPaperGroup(
      this.imageRaster.bounds.topLeft,
      this.params
    );
    this.reflectLabels = result;
    this.pathItemGroup = generatorGroup;
    this.resizeGroup.addChild(generatorGroup);
  }
  initApp() {
    this.params = {
      showMask: false,
      scaleValueX: 1,
      scaleValueY: 1,
      originalWidth: null,
      originalHeight: null,
      currentSelectedTool: "pointer",
      toolMap: {
        pointer: PointerTool,
        remove: RemoveTool,
        add: AddTool,
        split: SplitTool,
        link: LinkTool,
        cross: CrossTool,
      },
    };
    const canvas = document.getElementById("paperCanvas");
    const viewer = document
      .getElementById("paperCanvas")
      .getBoundingClientRect();
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // 加载
    this.paperScope = new paper.PaperScope().setup("paperCanvas");
    this.paperView = this.paperScope.view;
    this.paperView.backgroundColor = "#f0f0f0";
    this.paperView.viewSize = new paper.Size(viewer.width, viewer.height);
    this.paperProject = this.paperScope.project;
    this.limitInitBounds = this.paperView.bounds.clone();
  }
  replacePathItemWithPathList(pathList) {
    const _this = this;
    if (this.selected) {
      const index = this.reflectLabels.findIndex(
        (ele) => ele.pathItem.id === _this.selected.pathItem.id
      );
      this.reflectLabels.splice(index, 1);
      pathList.forEach((ele) => _this.pathItemGroup.addChild(ele.pathItem));
      this.reflectLabels.push(...pathList);
    }
  }
  loadImageSource() {
    const _that = this;
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      // 1. 加载图片
      this.imageRaster = new paper.Raster(this.dataSource.oldImageUrl);
      this.imageRaster.crossOrigin = "anonymous";
      this.imageRaster.onLoad = () => {
        canvas.width = this.imageRaster.width;
        canvas.height = this.imageRaster.height;
        context.drawImage(this.imageRaster.image, 0, 0);
        console.log(canvas.toDataURL("image/png"));
        const originalWidth = _that.imageRaster.bounds.width;
        const originalHeight = _that.imageRaster.bounds.height;
        _that.imageRaster.fitBounds(_that.paperView.bounds, false);
        _that.params.originalWidth = originalWidth;
        _that.params.originalHeight = originalHeight;
        _that.params.scaleValueX =
          _that.imageRaster.bounds.width / originalWidth;
        _that.params.scaleValueY =
          _that.imageRaster.bounds.height / originalHeight;
        _that.resizeGroup = new paper.Group();
        _that.resizeGroup.addChild(_that.imageRaster);
        resolve();
      };
    });
  }
  initGUI() {
    const _this = this;
    this.gui = new GUI();
    this.gui.add(document, "title").name("案例名称");
    this.gui
      .add(this.params, "showMask")
      .name("Mask")
      .onChange((val) => {
        _this.mask.visible = val;
      });
    this.gui
      .add(this.params, "currentSelectedTool", [
        "pointer",
        "remove",
        "add",
        "split",
        "link",
        "cross",
      ])
      .name("工具")
      .onChange((val) => {
        _this.updateTool(val);
      });
    // this.gui.add(this.pathItemGroup, "opacity", 0, 1.0, 0.01).name("透明度");
  }
  receiveSubHelper(helper) {
    this.helper = helper;
  }
  updateTool(val) {
    if (this.tool) {
      this.tool.remove();
    }
    if (this.helper) {
      this.helper.remove();
    }
    // resetOthers(app.reflectLabels, -1);
    this.tool = new paper.Tool();
    this.tool.on(this.params["toolMap"][val](this));
    this.tool.activate();
  }
  initTool() {
    this.tool = new paper.Tool();
    this.tool.on(PointerTool(this));
    this.tool.activate();
  }
  updatePathItem(id, pathItem) {
    const index = app.reflectLabels.findIndex((ele) => ele.pathItem.id === id);
    app.reflectLabels[index].pathItem = pathItem;
  }
  addEventListener() {
    const _that = this;
    window.addEventListener("resize", () => {
      // 改变viewSize
      const viewer = document
        .getElementById("paperCanvas")
        .getBoundingClientRect();
      _that.paperView.viewSize = new paper.Size(viewer.width, viewer.height);
      _that.resizeGroup.fitBounds(_that.paperView.bounds, false);
      // 更新scaleValue
      _that.params.scaleValueX =
        _that.imageRaster.bounds.width / _that.params.originalWidth;
      _that.params.scaleValueY =
        _that.imageRaster.bounds.height / _that.params.originalHeight;
      _that.limitInitBounds = _that.paperView.bounds.clone();
    });
    window.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    window.addEventListener("wheel", (e) => {
      const mousePosition = new paper.Point(e.offsetX, e.offsetY);
      const viewPosition = _that.paperView.viewToProject(mousePosition);
      const zoomParams = stableZoom(
        _that.paperView.zoom,
        e.deltaY,
        _that.paperView.center,
        viewPosition
      );
      if (zoomParams.zoom > 10.0 || zoomParams.zoom < 1.0) {
        return;
      }
      _that.paperView.zoom = zoomParams.zoom;
      _that.paperView.center = _that.paperView.center.add(zoomParams.offset);
      const matrix = _that.paperView.matrix;
      const viewPort = {
        x: -(matrix.tx / matrix.a),
        y: -(matrix.ty / matrix.a),
        width: _that.paperView.bounds.width,
        height: _that.paperView.bounds.height,
      };
      if (viewPort.y < 0) {
        _that.paperView.matrix = matrix.translate(
          new paper.Point(0, viewPort.y)
        );
      }
      if (viewPort.y + viewPort.height > this.limitInitBounds.height) {
        _that.paperView.matrix = matrix.translate(
          new paper.Point(
            0,
            viewPort.y + viewPort.height - this.limitInitBounds.height
          )
        );
      }
      if (viewPort.x + viewPort.width > this.limitInitBounds.width) {
        _that.paperView.matrix = matrix.translate(
          new paper.Point(
            viewPort.x + viewPort.width - this.limitInitBounds.width,
            0
          )
        );
      }
      if (viewPort.x < 0) {
        _that.paperView.matrix = matrix.translate(
          new paper.Point(viewPort.x, 0)
        );
      }
    });
  }
}

const app = new App(dataSource);
