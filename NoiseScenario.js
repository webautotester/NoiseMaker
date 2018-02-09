/*Copyright (c) 2017-2018 Xavier Blanc <blancxav@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*/

const winston = require('winston');
const wat_scenario = require('wat_scenario');

class NoiseScenario {

	constructor(baseScenario, assertFunction, noiseLevel) {
		this.baseScenario = baseScenario;
		this.assertFunction = assertFunction;
		this.noiseLevel = noiseLevel;
	}
    
	async detectCandidateAction(page) {
		this.candidateActions = [];
        for (let i=0 ; i < this.baseScenario.actions.length ; i++) {
			this.candidateActions[i] = [];
			await this.baseScenario.actions[i].run(page);
			await page.addScriptTag({path:'./optimal-select.js'});
			let candidateSelector = await page.evaluate(scanCandidateAction);
			candidateSelector.forEach(selector => {
				this.candidateActions[i].push({
					action : new wat_scenario.ClickAction(selector),
					proba : 1/candidateSelector.length,
					phantom : 0,
					outside : 0,
					assertTrue : 0,
					assertFalse : 0
				});
			});
        }
	}
    
	async runWithNoise(page) {
		for (let i=0 ; i < this.baseScenario.actions.length ; i++) {
			try {
				await this.baseScenario.actions[i].run(page);
			} catch (ex) {
				winston.error(ex);
				winston.info('base action cannot run !');
			}
			try {
				let candidateAction = this.pickUpOneCandidateAction(i);
				await candidateAction.action.run(page);
			} catch (ex) {
				winston.error(ex);
				winston.info('candidate action cannot run !');
			}
			//evaluate
		}
	}

	pickUpOneCandidateAction(index) {
		let random = Math.random();
		winston.info(`random=${random}`);
		let proba = 0;
		for (let i = 0 ; i < this.candidateActions[index].length ; i++) {
			let candidateAction = this.candidateActions[index][i];
			proba = proba + candidateAction.proba;
			if (random < proba) {
				winston.info(` action ${i} has been choosed`);
				return candidateAction;
			}
		}
	}

	getCandidateActions() {
		return this.candidateActions;
	}
}


function scanCandidateAction() {
	let actions = [];
	let computeCSSSelector = window['OptimalSelect'].select;
	let aElements = document.querySelectorAll('a');
	for (let i=0 ; i < aElements.length ; i++) {
		actions.push(computeCSSSelector(aElements[i]));
	}
	return actions;
}


module.exports.NoiseScenario = NoiseScenario;