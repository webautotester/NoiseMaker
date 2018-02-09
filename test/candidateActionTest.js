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

const NoiseScenario = require('../NoiseScenario.js').NoiseScenario;
const lib = require('wat_scenario');
const assert = require('assert');
const puppeteer = require('puppeteer');

const scenario = new lib.Scenario();
const gotoAction = new lib.GotoAction('http://www.labri.fr');
const clickAction = new lib.ClickAction('#menu > ul:nth-child(7) > li:nth-child(2) > a');
scenario.addAction(gotoAction);
scenario.addAction(clickAction);

describe('Find Candidate Actions', function () {
	this.timeout(40000);
	it('should goto labri and return all <a> as candidate actions', async function() {
        let page = await createPage();
        noisyScenario = new NoiseScenario(scenario);
        await noisyScenario.detectCandidateAction(page);
        //ca = noisyScenario.getCandidateActions();
        //console.log(JSON.stringify(ca));

        for (let i = 0 ; i < 200 ; i++) {
            await noisyScenario.runWithNoise(page);
        }
        assert(true);
        page.close();
	});
});

async function createPage() {
    let browser;
    let page;
    
    browser = await puppeteer.launch({headless: false, args:['--no-sandbox']});
    page = await browser.newPage();
    return page;
}