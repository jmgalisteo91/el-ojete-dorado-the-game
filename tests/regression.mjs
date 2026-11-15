/**
 * Runner secuencial de pruebas de regresión.
 * Ejecutar con: node tests/regression.mjs
 */
import assert from 'node:assert/strict';
import * as playerSuite from './suites/player.test.mjs';
import * as enemiesSuite from './suites/enemies.test.mjs';
import * as saveSuite from './suites/save.test.mjs';
import * as audioSuite from './suites/audio.test.mjs';
import * as bossesSuite from './suites/bosses.test.mjs';
import * as worldSuite from './suites/world.test.mjs';

const suites = [
  ['player.test.mjs', playerSuite],
  ['enemies.test.mjs', enemiesSuite],
  ['save.test.mjs', saveSuite],
  ['audio.test.mjs', audioSuite],
  ['bosses.test.mjs', bossesSuite],
  ['world.test.mjs', worldSuite],
];

let passed = 0;
let total = 0;
const failures = [];

for (const [suiteFile, suite] of suites) {
  const queue = [];
  const test = (name, fn) => queue.push({ name, fn });
  await suite.run(test, assert);
  for (const { name, fn } of queue) {
    total++;
    try {
      await fn();
      passed++;
    } catch (err) {
      failures.push({ suiteFile, name, err });
      console.error(`[FAIL] ${suiteFile}: ${name}\n${err?.stack || err}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n❌ ${passed}/${total} tests pasados (${failures.length} fallos)`);
  process.exit(1);
}
console.log(`\n✅ ${passed}/${total} tests pasados`);
