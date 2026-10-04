const isPoint = (point) => point != null
  && Number.isFinite(point.x)
  && Number.isFinite(point.y);

/** Measures scratched area once per grid cell, independent of pointer frequency. */
export class ScratchCoverage {
  #width;
  #height;
  #columns;
  #rows;
  #threshold;
  #cells;
  #erased = 0;

  constructor(width, height, { columns = 96, rows = 24, threshold = 0.4 } = {}) {
    if (!Number.isFinite(width) || width <= 0
      || !Number.isFinite(height) || height <= 0) {
      throw new RangeError('Scratch dimensions must be positive finite numbers.');
    }
    if (!Number.isSafeInteger(columns) || columns <= 0
      || !Number.isSafeInteger(rows) || rows <= 0
      || !Number.isSafeInteger(columns * rows)) {
      throw new RangeError('Scratch grid dimensions must be positive safe integers.');
    }
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      throw new RangeError('Scratch threshold must be greater than zero and at most one.');
    }

    this.#width = width;
    this.#height = height;
    this.#columns = columns;
    this.#rows = rows;
    this.#threshold = threshold;
    this.#cells = new Uint8Array(columns * rows);
  }

  get progress() {
    return this.#erased / this.#cells.length;
  }

  get complete() {
    return this.progress >= this.#threshold;
  }

  erase(fromPoint, toPoint, radius) {
    if (!isPoint(fromPoint) || !isPoint(toPoint)
      || !Number.isFinite(radius) || radius <= 0) {
      return this.progress;
    }

    const cellWidth = this.#width / this.#columns;
    const cellHeight = this.#height / this.#rows;
    const minX = Math.min(fromPoint.x, toPoint.x) - radius;
    const maxX = Math.max(fromPoint.x, toPoint.x) + radius;
    const minY = Math.min(fromPoint.y, toPoint.y) - radius;
    const maxY = Math.max(fromPoint.y, toPoint.y) + radius;

    if (maxX < 0 || minX > this.#width || maxY < 0 || minY > this.#height) {
      return this.progress;
    }

    const firstColumn = Math.max(0, Math.ceil(minX / cellWidth - 0.5));
    const lastColumn = Math.min(this.#columns - 1, Math.floor(maxX / cellWidth - 0.5));
    const firstRow = Math.max(0, Math.ceil(minY / cellHeight - 0.5));
    const lastRow = Math.min(this.#rows - 1, Math.floor(maxY / cellHeight - 0.5));
    const deltaX = toPoint.x - fromPoint.x;
    const deltaY = toPoint.y - fromPoint.y;
    const segmentLengthSquared = deltaX * deltaX + deltaY * deltaY;
    const radiusSquared = radius * radius;

    for (let row = firstRow; row <= lastRow; row += 1) {
      const y = (row + 0.5) * cellHeight;
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const index = row * this.#columns + column;
        if (this.#cells[index]) continue;

        const x = (column + 0.5) * cellWidth;
        const projection = segmentLengthSquared > 0
          ? Math.max(0, Math.min(1,
            ((x - fromPoint.x) * deltaX + (y - fromPoint.y) * deltaY)
              / segmentLengthSquared))
          : 0;
        const distanceX = x - (fromPoint.x + projection * deltaX);
        const distanceY = y - (fromPoint.y + projection * deltaY);

        if (distanceX * distanceX + distanceY * distanceY <= radiusSquared) {
          this.#cells[index] = 1;
          this.#erased += 1;
        }
      }
    }

    return this.progress;
  }

  reset() {
    this.#cells.fill(0);
    this.#erased = 0;
    return this.progress;
  }
}
