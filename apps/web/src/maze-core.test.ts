import { describe, expect, it } from 'vitest';
import {
  BAND_MAX,
  BAND_MIN,
  type Cell,
  MAZE_SIZE,
  generateMaze,
  shortestPath,
} from './maze-core.js';

describe('generateMaze — difficulty normalisation', () => {
  it('50 seeded runs all land in the difficulty band with a reachable center', () => {
    for (let seed = 0; seed < 50; seed++) {
      const maze = generateMaze(seed * 2654435761);
      expect(maze.size).toBe(MAZE_SIZE);
      // Center is a valid room and the shortest path to it is finite (perfect
      // maze carved from the center is always fully connected).
      const reach = shortestPath(maze.cells, maze.size, maze.entrance, maze.center);
      expect(reach).toBeGreaterThan(0);
      expect(reach).toBe(maze.pathLength);
      // Difficulty normalised into the band.
      expect(maze.inBand).toBe(true);
      expect(maze.pathLength).toBeGreaterThanOrEqual(BAND_MIN);
      expect(maze.pathLength).toBeLessThanOrEqual(BAND_MAX);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateMaze(12345);
    const b = generateMaze(12345);
    expect(a.pathLength).toBe(b.pathLength);
    expect(a.entrance).toEqual(b.entrance);
    expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells));
  });

  it('center is the exact middle room', () => {
    const maze = generateMaze(7);
    expect(maze.center).toEqual({ x: (MAZE_SIZE - 1) / 2, y: (MAZE_SIZE - 1) / 2 });
  });

  it('entrance sits on the perimeter', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { entrance, size } = generateMaze(seed + 99);
      const onEdge =
        entrance.x === 0 || entrance.y === 0 || entrance.x === size - 1 || entrance.y === size - 1;
      expect(onEdge).toBe(true);
    }
  });

  it('walls are symmetric between adjacent rooms', () => {
    const { cells, size } = generateMaze(555);
    for (let y = 0; y < size; y++) {
      const row = cells[y] as Cell[];
      const rowBelow = (cells[y + 1] ?? []) as Cell[];
      for (let x = 0; x < size; x++) {
        const cell = row[x] as Cell;
        // East wall of (x,y) must equal West wall of (x+1,y).
        if (x + 1 < size) {
          expect(cell.walls[1]).toBe((row[x + 1] as Cell).walls[3]);
        }
        // South wall of (x,y) must equal North wall of (x,y+1).
        if (y + 1 < size) {
          expect(cell.walls[2]).toBe((rowBelow[x] as Cell).walls[0]);
        }
      }
    }
  });

  it('shortestPath returns 0 for identical endpoints', () => {
    const { cells, size } = generateMaze(3);
    expect(shortestPath(cells, size, { x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
  });
});
