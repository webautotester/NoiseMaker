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

const puppeteer = require('puppeteer');

const PROBA_CHANGER = 1;


class NoiseScenario {

	constructor(baseScenario, assertFunction, noiseLevel) {
		this.baseScenario = baseScenario;
		this.assertFunction = assertFunction;
		this.noiseLevel = noiseLevel;
	}
    
	async detectCandidateAction() {
		let page = await this.createPage();
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
    
	async runWithNoise() {
		
		let page = await this.createPage();
		let runContext = {iBaseScenario:0,iCandidateAction:-1};

		page.on('dialog', (dialog) => {
			if (runContext.iCandidateAction !== -1) {
				this.decreaseCandidateActionProba(runContext.iBaseScenario, runContext.iCandidateAction);
			}
			dialog.dismiss();
		})
		
		this.browser.on('targetcreated', (ev) => {
			winston.info(`target created : ${ev.type()} , ${ev.url()}, ${ev.page()}`);
			winston.info(`runContext : ${runContext.iBaseScenario}`);
			if (runContext.iCandidateAction !== -1) {
				this.decreaseCandidateActionProba(runContext.iBaseScenario, runContext.iCandidateAction);
			}
			ev.page().then ( page => page.close());
		});
		let caIndex;
		let iCandidateAction;
		for (let iBaseScenario=0 ; iBaseScenario < this.baseScenario.actions.length ; iBaseScenario++) {
			runContext.iBaseScenario = iBaseScenario;
			try {
				runContext.iCandidateAction = -1;
				await this.baseScenario.actions[iBaseScenario].run(page);
			} catch (ex) {
				winston.error(ex);
				winston.info('base action cannot run !');
				this.candidateActions[iBaseScenario-1][iCandidateAction].outside = this.candidateActions[iBaseScenario-1][iCandidateAction].outside + 1;
				this.decreaseCandidateActionProba(iBaseScenario-1, iCandidateAction);
			}
			try {
				iCandidateAction = this.pickUpOneCandidateAction(iBaseScenario);
				runContext.iCandidateAction = iCandidateAction;
				let candidateAction = this.candidateActions[iBaseScenario][iCandidateAction];
				await candidateAction.action.run(page);
			} catch (ex) {
				winston.error(ex);
				winston.info('candidate action cannot run !');
				this.candidateActions[iBaseScenario][iCandidateAction].phantom = this.candidateActions[iBaseScenario-1][iCandidateAction].phantom + 1;
				this.decreaseCandidateActionProba(iBaseScenario, iCandidateAction);
			}
			//evaluate
		}
		page.close();
		this.browser.removeAllListeners('targetcreated');
	}

	pickUpOneCandidateAction(iBaseScenario) {
		let random = Math.random();
		winston.info(`random=${random}`);
		let proba = 0;
		for (let iCandidateAction = 0 ; iCandidateAction < this.candidateActions[iBaseScenario].length ; iCandidateAction++) {
			let candidateAction = this.candidateActions[iBaseScenario][iCandidateAction];
			proba = proba + candidateAction.proba;
			if (random < proba) {
				winston.info(` action ${iCandidateAction} has been choosed`);
				return iCandidateAction;
			}
		}
		winston.info(` action ${this.candidateActions[iBaseScenario].length-1} has been choosed`);
		return (this.candidateActions[iBaseScenario].length-1);
	}

	decreaseCandidateActionProba(iBaseScenario, iCandidateAction) {
		let oldProba = this.candidateActions[iBaseScenario][iCandidateAction].proba;
		let newProba = sigmoid(logit(oldProba) - PROBA_CHANGER); 
		this.candidateActions[iBaseScenario][iCandidateAction].proba = newProba;
		winston.info(`Proba changed from ${oldProba} to ${newProba}`);
		
		let decrease = oldProba - newProba;
		winston.info(`decrease is ${decrease}`);

		if (this.candidateActions[iBaseScenario].length > 1) {
			let increase = (decrease) / (this.candidateActions[iBaseScenario].length-1);
			winston.info(`shared increase is ${increase}`);
			for (let i = 0 ; i < this.candidateActions[iBaseScenario].length ; i++) {
				if (i !== iCandidateAction) {
					this.candidateActions[iBaseScenario][i].proba = this.candidateActions[iBaseScenario][i].proba + increase;
				}
			}
		}
	}

	increaseCandidateActionProba(iBaseScenario, iCandidateAction) {
		let oldProba = this.candidateActions[iBaseScenario][iCandidateAction].proba;
		let newProba = sigmoid(logit(oldProba) + PROBA_CHANGER); 
		this.candidateActions[iBaseScenario][iCandidateAction].proba = newProba;
		winston.info(`Proba changed from ${oldProba} to ${newProba}`);

		let increase = newProba - oldProba;

		if (this.candidateActions[iBaseScenario].length > 1) {
			let decrease = (increase) / (this.candidateActions[iBaseScenario].length-1);
			for (let i = 0 ; i < this.candidateActions[iBaseScenario].length ; i++) {
				if (i !== iCandidateAction) {
					this.candidateActions[iBaseScenario][i].proba = this.candidateActions[iBaseScenario][i].proba - decrease;
				}
			}
		}		
	}

	

	getCandidateActions() {
		return this.candidateActions;
	}

	async initBrowser() {
		if (! this.browser) this.browser =  await puppeteer.launch({headless: false, args:['--no-sandbox']});
	}

	async createPage() {
		await this.initBrowser();
		let page = await this.browser.newPage();
		return page;
	}
}


function scanCandidateAction() {
	let actions = [];
	let computeCSSSelector = window['OptimalSelect'].select;
	let aElements = document.querySelectorAll('a');
	for (let i=0 ; i < aElements.length ; i++) {
		if (! isMailTo(aElements[i])) actions.push(computeCSSSelector(aElements[i]));
	}
	return actions;

	function isMailTo(element) {
		let href = element.href;
		return href && (href.toLowerCase().indexOf('mailto') > -1)
		
	}
}

function sigmoid(t) {
    return 1/(1+Math.pow(Math.E, -t));
}

function logit(p) {
    return Math.log(p / (1-p));
}






module.exports.NoiseScenario = NoiseScenario;