const paper = window["paper"];
const cv = window["cv"];

export function resetOthers(arr, exceptId) {
  arr.forEach((ele) => {
    if (ele.pathItem.id !== exceptId) {
      ele.pathItem.fillColor = "gray";
      ele.pathItem.fillColor.alpha = 0.01;
    }
  });
}

export function getPathByCurves(curves, app) {
  const topLeft = app.mask.bounds.topLeft;
  const path = new paper.Path({ insert: false });
  for (const curve of curves) {
    for (let point of curve.points) {
      path.add(
        new paper.Point(
          (point.x - topLeft.x) / app.params.scaleValueX,
          (point.y - topLeft.y) / app.params.scaleValueY
        )
      );
    }
  }
  return path;
}

export function getPointsByCurves(curves, app) {
  const topLeft = app.mask.bounds.topLeft;
  const result = [];
  for (const curve of curves) {
    for (let point of curve.points) {
      result.push([
        (point.x - topLeft.x) / app.params.scaleValueX,
        (point.y - topLeft.y) / app.params.scaleValueY,
      ]);
    }
  }
  return result;
}

export function wrapperPathData(path, app) {
  const newPath = getPathByCurves(path.curves, app);
  return newPath.pathData;
}

export function getFilledPath(path, app) {
  const outerPath = offsetPath(path, 10);
  const innerPath = offsetPath(path, -10);
  innerPath.reverse();
  var deleteShape = new paper.Path({
    closed: true,
    insert: false,
  });
  deleteShape.addSegments(outerPath.segments);
  deleteShape.addSegments(innerPath.segments);
  function createGoodCircle(center, radius) {
    const circle = new paper.Path.Circle({
      center: center,
      radius: radius,
      insert: false,
    });
    return circle;
  }
  const startCircle = createGoodCircle(path.firstSegment.point, 10);
  const endCircle = createGoodCircle(path.lastSegment.point, 10);
  const endCaps = new paper.CompoundPath({
    children: [startCircle, endCircle],
    insert: false,
  });
  deleteShape = deleteShape.unite(endCaps);
  const operationPath = getPathByCurves(deleteShape.curves, app);
  return {
    needAddPath: operationPath,
    deleteShape,
  };
}

export function offsetPath(path, offset) {
  var outerPath = new paper.Path({ insert: false }),
    epsilon = 1e-7,
    enforeArcs = true;
  if (!path || !path.curves) {
    return;
  }

  for (let i = 0; i < path.curves.length; i++) {
    var curve = path.curves[i];
    if (curve.hasLength(epsilon)) {
      var segments = getOffsetSegments(curve, offset),
        start = segments[0];
      if (outerPath.isEmpty()) {
        outerPath.addSegments(segments);
      } else {
        var lastCurve = outerPath.lastCurve;
        if (!lastCurve.point2.isClose(start.point, epsilon)) {
          if (
            enforeArcs ||
            lastCurve
              .getTangentAtTime(1)
              .dot(start.point.subtract(curve.point1)) >= 0
          ) {
            addRoundJoin(
              outerPath,
              start.point,
              curve.point1,
              Math.abs(offset)
            );
          } else {
            // Connect points with a line
            outerPath.lineTo(start.point);
          }
        }
        outerPath.lastSegment.handleOut = start.handleOut;
        outerPath.addSegments(segments.slice(1));
      }
    }
  }
  if (path.isClosed()) {
    if (
      !outerPath.lastSegment.point.isClose(
        outerPath.firstSegment.point,
        epsilon
      ) &&
      (enforeArcs ||
        outerPath.lastCurve
          .getTangentAtTime(1)
          .dot(
            outerPath.firstSegment.point.subtract(path.firstSegment.point)
          ) >= 0)
    ) {
      addRoundJoin(
        outerPath,
        outerPath.firstSegment.point,
        path.firstSegment.point,
        Math.abs(offset)
      );
    }
    outerPath.closePath();
  }
  return outerPath;
}

function getOffsetSegments(curve, offset) {
  if (curve.isStraight()) {
    var n = curve.getNormalAtTime(0.5).multiply(offset),
      p1 = curve.point1.add(n),
      p2 = curve.point2.add(n);
    return [new paper.Segment(p1), new paper.Segment(p2)];
  } else {
    var curves = splitCurveForOffseting(curve),
      segments = [];
    for (var i = 0, l = curves.length; i < l; i++) {
      var offsetCurves = this.getOffsetCurves(curves[i], offset, 0),
        prevSegment;
      for (var j = 0, m = offsetCurves.length; j < m; j++) {
        var curve = offsetCurves[j],
          segment = curve.segment1;
        if (prevSegment) {
          prevSegment.handleOut = segment.handleOut;
        } else {
          segments.push(segment);
        }
        segments.push((prevSegment = curve.segment2));
      }
    }
    return segments;
  }
}

function splitCurveForOffseting(curve) {
  var curves = [curve.clone()], // Clone so path is not modified.
    that = this;
  if (curve.isStraight()) return curves;

  function splitAtRoots(index, roots) {
    for (var i = 0, prevT, l = roots && roots.length; i < l; i++) {
      var t = roots[i],
        curve = curves[index].divideAtTime(
          // Renormalize curve-time for multiple roots:
          i ? (t - prevT) / (1 - prevT) : t
        );
      prevT = t;
      if (curve) curves.splice(++index, 0, curve);
    }
  }

  // Split curves at cusps and inflection points.
  var info = curve.classify();
  if (info.roots && info.type !== "loop") {
    splitAtRoots(0, info.roots);
  }

  // Split sub-curves at peaks.
  for (var i = curves.length - 1; i >= 0; i--) {
    splitAtRoots(i, paper.Curve["getPeaks"](curves[i].getValues()));
  }

  // Split sub-curves with too large angle between handles.
  for (var i = curves.length - 1; i >= 0; i--) {
    //splitLargeAngles(i, 0);
  }
  return curves;
}

function addRoundJoin(path, dest, center, radius) {
  // return path.lineTo(dest);
  var middle = path.lastSegment.point.add(dest).divide(2),
    through = center.add(middle.subtract(center).normalize(radius));
  path.arcTo(through, dest);
}

function getBBox(points) {
  let bbox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  points.forEach((ele) => {
    bbox.minX = Math.min(ele[0], bbox.minX);
    bbox.minY = Math.min(ele[1], bbox.minY);
    bbox.maxX = Math.max(ele[0], bbox.maxX);
    bbox.maxY = Math.max(ele[1], bbox.maxY);
  });
  return bbox;
}

export function generatorPathByLabel(label, app) {
  // 1. 在一张新的图像上面绘制图像
  const canvas = document.createElement("canvas");
  canvas.width = app.mask.canvas.width;
  canvas.height = app.mask.canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  label.points.forEach((ele, index) => {
    if (index === 0) {
      ctx.moveTo(ele[0], ele[1]);
    } else {
      ctx.lineTo(ele[0], ele[1]);
    }
  });
  ctx.clip();
  ctx.drawImage(app.mask.canvas, 0, 0);
  const src = cv.imread(canvas);
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
  cv.threshold(src, src, 100, 255, cv.THRESH_BINARY_INV);
  cv.findContours(
    src,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );
  const contoursArray = [];
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const contourPoints = [];
    for (let j = 0; j < cnt.data32S.length; j += 2) {
      const x = cnt.data32S[j];
      const y = cnt.data32S[j + 1];
      contourPoints.push([x, y]);
    }
    contoursArray.push(contourPoints);
  }
  src.delete();
  contours.delete();
  hierarchy.delete();
  return contoursArray;
}

function findClosestSegment(path1, path2) {
  let closestSegment = null;
  let minDistance = Infinity;
  let index = 0;
  // 遍历 path1 的每个线段
  for (let i = 0; i < path1.segments.length; i++) {
    const segment1 = path1.segments[i];
    // 遍历 path2 的每个线段
    for (let j = 0; j < path2.segments.length; j++) {
      const segment2 = path2.segments[j];
      // 计算两个线段之间的距离
      const distance = segment1.point.getDistance(segment2.point);
      // 如果当前距离小于最小距离,更新最小距离和最近线段
      if (distance < minDistance) {
        minDistance = distance;
        closestSegment = segment1;
        index = i;
      }
    }
  }
  let endPoint = null;
  let fontPoint = null;
  let fontPointIndex = null;
  let backPointIndex = null;
  let backPoint = null;
  // 判断前面的点距离长还是后面的点距离长
  if (index === 0) {
    fontPoint = path1.segments[index + 1].point;
    backPoint = path1.segments[path1.segments.length - 1].point;
    fontPointIndex = index + 1;
    backPointIndex = path1.segments.length - 1;
  } else if (index === path1.segments.length - 1) {
    fontPoint = path1.segments[0].point;
    backPoint = path1.segments[index - 1].point;
    fontPointIndex = 0;
    backPointIndex = index - 1;
  } else {
    fontPoint = path1.segments[index + 1].point;
    backPoint = path1.segments[index - 1].point;
    fontPointIndex = index + 1;
    backPointIndex = index - 1;
  }
  if (
    fontPoint.getDistance(closestSegment.point) >
    backPoint.getDistance(closestSegment.point)
  ) {
    endPoint = fontPointIndex;
  } else {
    endPoint = backPointIndex;
  }
  return {
    startPointIndex: index,
    endPointIndex: endPoint,
  };
}

function redefinePathEnds(path, si, ei) {
  const segments = path.segments;
  let result = [];
  if (si < ei && si !== 0 && ei !== 0) {
    result.push(...segments.slice(0, si).reverse());
    result.push(...segments.slice(ei, segments.length - 1).reverse());
  } else if (ei === 0 && si === 1) {
    console.log("2");
    result.push(...segments.slice(si, segments.length - 1));
    result.push(segments[ei]);
  } else if (ei === 0 && si === segments.length - 1) {
    console.log("3");
    result.push(...segments.reverse());
  } else if (si === 0 && ei === 1) {
    console.log("4");
    result.push(segments[si]);
    result.push(...segments.slice(1, segments.length - 1).reverse());
  } else if (si === 0 && ei === segments.length - 1) {
    console.log("5");
    result.push(segments[si]);
    result.push(...segments.slice(1, segments.length - 1));
  } else {
    console.log("6");
    result.push(...segments.slice(si, segments.length - 1));
    result.push(...segments.slice(0, ei));
  }
  path.segments = result;
  return path;
}
export function mergePathsWithinDistance(path1, path2, maxDistance) {
  // 创建一个新的 Path 对象
  const mergedPath = new paper.Path();
  let removedPath1 = new paper.Path();
  let removedPath2 = new paper.Path();
  // 遍历第一个 Path 的所有线段
  for (let i = 0; i < path1.segments.length; i++) {
    const segment1 = path1.segments[i];
    let shouldRemove = false;
    // 遍历第二个 Path 的所有线段
    for (let j = 0; j < path2.segments.length; j++) {
      const segment2 = path2.segments[j];
      // 计算两个线段端点之间的距离
      const distance = segment1.point.getDistance(segment2.point);
      // 如果距离小于等于 maxDistance，标记该点为需要移除
      if (distance <= maxDistance) {
        shouldRemove = true;
        break;
      }
    }

    // 如果该点不需要移除，将其添加到合并后的 Path 中
    if (!shouldRemove) {
      removedPath1.add(segment1.point);
      // mergedPath.add(segment1.point);
    }
  }
  // 遍历第二个 Path 的所有线段
  for (let i = 0; i < path2.segments.length; i++) {
    const segment2 = path2.segments[i];
    let shouldRemove = false;

    // 遍历第一个 Path 的所有线段
    for (let j = 0; j < path1.segments.length; j++) {
      const segment1 = path1.segments[j];
      // 计算两个线段端点之间的距离
      const distance = segment2.point.getDistance(segment1.point);
      // 如果距离小于等于 maxDistance，标记该点为需要移除
      if (distance <= maxDistance) {
        shouldRemove = true;
        break;
      }
    }
    // 如果该点不需要移除，将其添加到合并后的 Path 中
    if (!shouldRemove) {
      removedPath2.add(segment2.point);
    }
  }
  removedPath1.closed = true;
  removedPath2.closed = true;
  function redefinePath(path1, path2) {
    const { startPointIndex, endPointIndex } = findClosestSegment(path1, path2);
    return redefinePathEnds(path1, startPointIndex, endPointIndex);
  }
  removedPath1 = redefinePath(removedPath1, removedPath2);
  removedPath2 = redefinePath(removedPath2, removedPath1);
  const path1LastSegments = removedPath1.lastSegment.point;

  // new paper.Path.Circle({
  //   radius: 1,
  //   center: removedPath1.firstSegment.point,
  //   fillColor: "red",
  // });
  // new paper.Path.Circle({
  //   radius: 1,
  //   center: removedPath1.lastSegment.point,
  //   fillColor: "blue",
  // });
  // new paper.Path.Circle({
  //   radius: 1,
  //   center: removedPath2.firstSegment.point,
  //   fillColor: "red",
  // });
  // new paper.Path.Circle({
  //   radius: 1,
  //   center: removedPath2.lastSegment.point,
  //   fillColor: "blue",
  // });
  if (
    removedPath2.firstSegment.point.getDistance(path1LastSegments) >
    removedPath2.lastSegment.point.getDistance(path1LastSegments)
  ) {
    removedPath2.reverse();
  }
  removedPath1.segments.forEach((segment) => mergedPath.add(segment.point));
  removedPath2.segments.forEach((segment) => mergedPath.add(segment.point));
  mergedPath.closed = true;
  return mergedPath;
}

export function findClosestDistanceBetweenPaths(path1, path2) {
  if (
    !path1 ||
    !path2 ||
    path1.segments.length === 0 ||
    path2.segments.length === 0
  ) {
    console.error("One of the paths is invalid or has no segments.");
    return Infinity;
  }

  let minDistance = Infinity;

  // 遍历第一个路径的所有段
  path1.segments.forEach((segment1) => {
    // 遍历第二个路径的所有段
    path2.segments.forEach((segment2) => {
      // 计算当前两点之间的距离
      let distance = segment1.point.getDistance(segment2.point);
      // 更新最小距离
      if (distance < minDistance) {
        minDistance = distance;
      }
    });
  });

  return minDistance;
}

export function isPathInsideAnother(path1, path2) {
  if (!path1 || !path2) {
    console.error("Invalid paths provided.");
    return false;
  }

  // 检查 path1 的每个段的每个点是否都在 path2 内
  for (let i = 0; i < path1.segments.length; i++) {
    let segment = path1.segments[i];
    // 检查每个段的点
    if (!path2.contains(segment.point)) {
      return false;
    }
  }

  return true;
}

function findNearestPoint(segments, point, excludePoint) {
  let nearestPoint = null;
  let minDistance = Infinity;
  for (const segment of segments) {
    const distance = segment.point.getDistance(point);
    if (distance < minDistance && !excludePoint.includes(segment)) {
      minDistance = distance;
      nearestPoint = segment;
    }
  }
  return nearestPoint;
}

export function caculateExcusive(mousePoint, path) {
  const segments = path.segments;
  const seedTopLeft = new paper.Point(mousePoint.x - 5, mousePoint.y - 5);
  const seedTopRight = new paper.Point(mousePoint.x + 5, mousePoint.y - 5);
  const seedBottomLeft = new paper.Point(mousePoint.x - 5, mousePoint.y + 5);
  const seedBottomRight = new paper.Point(mousePoint.x + 5, mousePoint.y + 5);
  const nearestTopLeftPoint = findNearestPoint(segments, seedTopLeft, []);
  const nearestTopRightPoint = findNearestPoint(segments, seedTopRight, [
    nearestTopLeftPoint,
  ]);
  const nearestBottomLeftPoint = findNearestPoint(segments, seedBottomLeft, [
    nearestTopLeftPoint,
    nearestTopRightPoint,
  ]);
  const nearestBottomRightPoint = findNearestPoint(segments, seedBottomRight, [
    nearestTopLeftPoint,
    nearestTopRightPoint,
    nearestBottomLeftPoint,
  ]);
  return [
    nearestTopLeftPoint,
    nearestTopRightPoint,
    nearestBottomLeftPoint,
    nearestBottomRightPoint,
  ];
}

export function convexHull(points) {
  points.sort(function (a, b) {
    return a.x != b.x ? a.x - b.x : a.y - b.y;
  });
  var n = points.length;
  var hull = [];
  for (var i = 0; i < 2 * n; i++) {
    var j = i < n ? i : 2 * n - 1 - i;
    while (
      hull.length >= 2 &&
      removeMiddle(hull[hull.length - 2], hull[hull.length - 1], points[j])
    )
      hull.pop();
    hull.push(points[j]);
  }
  hull.pop();
  return hull;
}

function removeMiddle(a, b, c) {
  var cross = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x);
  var dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
  return cross < 0 || (cross == 0 && dot <= 0);
}

export function caculateSplitTwoChromosome(pathItem, splitPath) {
  const path = pathItem.subtract(splitPath, {
    insert: false,
    trace: true,
  });
  return path;
}

function split_path_by_segments(path, point1, point2) {
  const location1 = path.getNearestLocation(point1);
  const location2 = path.getNearestLocation(point2);
  const path1 = path.splitAt(location1);
  const path2 = path1.splitAt(location2);
  var area1 = Math.abs(path1.area);
  var area2 = Math.abs(path2.area);
  if (area1 > area2) {
    path2.closed = true;
    return path2;
  } else {
    path1.closed = true;
    return path1;
  }
}

// 分为5个路径
// 1. 中心分割路径
// 上方路径
// 下方路径
// 左边路径
// 右边路径
export function splitPathWithNearestPoints(
  pathItem,
  helper,
  nearestPoint_collection
) {
  const top_path = split_path_by_segments(
    pathItem.clone(),
    nearestPoint_collection[0].point,
    nearestPoint_collection[1].point
  );
  const bottom_path = split_path_by_segments(
    pathItem.clone({ insert: false }),
    nearestPoint_collection[2].point,
    nearestPoint_collection[3].point
  );
  const left_path = split_path_by_segments(
    pathItem.clone({ insert: false }),
    nearestPoint_collection[0].point,
    nearestPoint_collection[2].point
  );
  const right_path = split_path_by_segments(
    pathItem.clone({ insert: false }),
    nearestPoint_collection[1].point,
    nearestPoint_collection[3].point
  );
  const chromosome1 = top_path
    .unite(helper.clone({ insert: false }), { insert: false })
    .unite(bottom_path, { insert: false });

  const chromosome2 = left_path
    .unite(helper.clone({ insert: false }), { insert: false })
    .unite(right_path, { insert: false });

  return [chromosome1, chromosome2];
}
