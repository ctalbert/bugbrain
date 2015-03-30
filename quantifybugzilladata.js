var assert = require('assert');
var async = require('async');
var fs = require('fs');
var util = require('util');
var request = require('request');
const BUGZILLA_REST_URL = 'https://bugzilla.mozilla.org/rest/';
var shortquery = 'https://bugzilla.mozilla.org/rest/bug?include_fields=id,summary,status&chfield=[Bug%20creation]&chfieldfrom=-3m&chfieldto=Now&email1=ctalbert%40mozilla.com&emailreporter1=1&emailtype1=substring&resolution=---&resolution=FIXED';

function calcReporterScore(reporterdata) {
    // Mozilla reporters are worth 1, non-mozilla reporters worth 0
    var mozRE = /mozilla(\.com|\.org|foundation\.org)/i;
    if (!reporterdata.email) {
        // Mal-formed data
        return -1;
    }
    var res = mozRE.exec(reporterdata.email); 
    return res ? 1.0 : 0.0;
}

function calcComponentScore(product, component) {
    // Calculate scores based on more specific product/comp matchings get 
    // higher scores, more general ones get lower
    res = 0.0;
    switch (product.toLowerCase()) {
        case 'core':
        case 'toolkit':
        case 'nspr':
        case 'nss':
        case 'mozilla services':
        case 'firefox os':
            res += 1.0;
            break;
        case 'firefox':
        case 'firefox for android':
        case 'firefox for ios': 
            res += 0.8;
            break;
        default: res += 0.3;
    }

    if (component.toLowerCase() == 'general') {
        res -= 0.3;
    }

    return res;
}

function calcResolutionScore(resolution, isopen) {
    // If the thing is already resolved then it gets 0, if it is open it gets a 1,
    // if it is already FIXED then it gets a 0.5 (because we might still 
    // need to track it for uplift)
    if (resolution == "FIXED" || resolution == "VERIFIED") {
        return 0.5
    } else if (!isopen) {
        // Dupe, invalid, etc
        return 0.0
    } else {
        // then it's open
        return 1.0
    }
}

function calcSeverityScore(severity) {
    var severities = ['enhancement', 'trivial', 'minor', 'normal', 'major', 'critical', 'blocker'];
    // TODO: This might be biasing the graph, re-adjusting to be between 0 and 1 
    //       so that it is on the same scale as the other values.
    /* Because severity scores are not linear we use a power of 10 to differentiate them.
     
    return Math.pow(10, severities.indexOf(severity));
    */
    // Trying a 0 to 1 approach
    return (severities.indexOf(severity)/10.0)
}

function calcSummaryScore(summary) {
    // Based on the word count of summary and whether we have:
    // + a specific technology referenced
    // + a "tag" i.e. we often do [<something>] in summaries ex: [e10s]
    summary = summary.toLowerCase();
    var interestingwords=["gfx", "graphics", "d3d", "css", "html", "layout", "network", "tls", "ssl", "ux"];
    var tagRE = /\[\w+\]/;
    var hastag = tagRE.exec(summary) ? 1 : 0;
    var interestingwordcount = 0;
    for (i=0; i < interestingwords.length; i++) {
        if (summary.search(interestingwords[i]) >= 0) {
            interestingwordcount++;
        }
    }
    // We count each interesting word as a score of 50 and tag as a score of 100
    // Because these tend to mean that it is a more specific bug. 
    // We convert this to a value in the range of 0 to 2 by dividing by 100.
    return (summary.split(' ').length + (50*interestingwordcount) + (100*hastag))/100.0;
}

function calcCommentScore(comment_text) {
    // Base the "goodness" of the comment on its detail so we measure word count and some
    // specific interesting items that we often see in good bugs:
    // URLs and mentions of other bugs (could think about expanding this to mentioning of 
    // specific technologies etc but let's start there.)
    comment_text = comment_text.toLowerCase();
    var httpRE = /(http|https)\:\/\/[A-Z]+/gi;
    var bugRE = /bug \d{5,}/gi;
    links = comment_text.match(httpRE) ? comment_text.match(httpRE).length : 0;
    bugs = comment_text.match(bugRE) ? comment_text.match(bugRE).length : 0;

    // We give 50 points for each link and bug reference and add that to the total word count.
    // Convert this to a number between 0 and 1-ish by dividing by 1000.
    var points = comment_text.split(' ').length + links*50 + bugs*50;
    return points/1000.0;
}

function quantifyBugzillaData(query, classifier, filepath) {
    var f = fs.openSync(filepath, 'a');
    var results = {};
    function completed(bugid){
        if (!results[bugid].written) {
            // object.keys() doesn't work in node?? :-/
            keys = [];
            for (var k in results[bugid]) keys.push(k);
            if (keys.length == 9) {
                // There are 9 keys when we are ready to write
                // Write our information out in a line to the file
                // Information is written in the form:
                // <classifier> <index>:<value>, <index>:<value>....
                fs.writeSync(f, util.format('%d 1:%d 2:%d 3:%d 4:%d 5:%d 6:%d 7:%d 8:%d 9:%d  #%s\n',
                            classifier, results[bugid]['cc_len'], results[bugid]['block_depend_len'],
                            results[bugid]['reporter_score'], results[bugid]['component_score'],
                            results[bugid]['resolution_score'], results[bugid]['severity_score'], 
                            results[bugid]['summary_score'], results[bugid]['comment_number'], 
                            results[bugid]['comment_0_richness'], bugid));
                results[bugid].written = true;
            }
        }
    }

    function processBugData(bugdata) {
        // Converts the dimensions of bug data into an array of numbers for analysis
        var q = async.queue(function (task, done) {
            request(task.url, function(e, r, b) {
                if (e) {
                    console.log("Error: Cannot get data for bug url: " + task.url + " Error: " + e);
                } else {
                    console.log("working on bug url: " + task.url);
                    if (task.type == "meta") {
                        var bugdetails = JSON.parse(b).bugs[0];
                        if (!results[task.bugid])
                            results[task.bugid] = {};
                        results[task.bugid]['cc_len'] = (bugdetails.cc.length / 10.0);
                        results[task.bugid]['block_depend_len'] = (bugdetails.blocks.length + bugdetails.depends_on.length)/10.0;
                        results[task.bugid]['reporter_score'] = calcReporterScore(bugdetails.creator_detail);
                        results[task.bugid]['component_score'] = calcComponentScore(bugdetails.product, bugdetails.component);
                        results[task.bugid]['resolution_score'] = calcResolutionScore(bugdetails.resolution, bugdetails.is_open);
                        results[task.bugid]['severity_score'] = calcSeverityScore(bugdetails.severity);
                        results[task.bugid]['summary_score'] = calcSummaryScore(bugdetails.summary);
                    } else { 
                        // Comment request
                        var commentdetails = JSON.parse(b).bugs;
                        if (!results[task.bugid])
                            results[task.bugid] = {};
                        results[task.bugid]['comment_number'] = (commentdetails[task.bugid]["comments"].length)/100.0;
                        if (commentdetails[task.bugid]["comments"].length > 0)
                            results[task.bugid]['comment_0_richness'] = calcCommentScore(commentdetails[task.bugid]["comments"][0].raw_text);
                        else
                            results[task.bugid]['comment_0_richness'] = 0;
                    } 

                    done(task.bugid);
                }
            });
        }, 5);
        
        for(i=0; i < bugdata.bugs.length; i++) {
            var bugid = bugdata.bugs[i].id;
            console.log("queueing bug: " + bugid);
            var url = BUGZILLA_REST_URL + 'bug/' + bugid;
            q.push({'url': url, 'bugid': bugid, 'type': 'meta'}, completed);
            q.push({'url': url + '/comment', 'bugid': bugid, 'type': 'comment'}, completed);
        }
    };
   
    request(query, function(error, response, body) {
        if (error && response.statusCode != 200) {
            console.log("Error: " + response.statusCode);
        } else {
            processBugData(JSON.parse(body));
        }
    });
}

module.exports=quantifyBugzillaData;
//quantifyBugzillaData(shortquery, 1, 'output.txt');

// Below are some functions used to test specific parts of the scoring system. You enable them by uncommenting 
// the last line of the file
function test_me() {
    console.log('starting testing');
    function test_comment_scoring() {
        var test_comment_2urls_2bugs = "I just wrote a new Selenium script to test custom fields and the ability to show/hide custom field values based on another field value, see bug 308253, and the script fails consistently (I can reproduce manually):\n\nI have a custom drop-down field whose value 'ghost' must only be visible when the bug resolution is FIXED. So if I set the resolution to FIXED, the 'ghost' value is selectable, but when I commit changes and revisit the bug, 'ghost' is no longer selected despite the bug history says the change was successful and despite the source code of the page has selected=\"selected\". From what I can see, the problem is in handleValControllerChange() in js/field.js, because it marks this value as unselected:\n\n            if (item.selected) {\n                item.selected = false;\n                bz_fireEvent(controlled_field, 'change');\n            }\n            item.disabled = true;\n\nIf I comment // item.selected = false; then 'ghost' remains visible when revisiting the bug. This is of course not the right fix as editing the bug resolution to something else doesn't hide 'ghost' again. But this shows that some code is missing to re-select this field value on page load.\n\n\nI tested with 4.0.x and 4.1.x and I can in both cases reproduce. I'm marking this bug as blocker because the next time you edit the bug, the field value is overriden as the https:// https://google.com http://mozilla.org wrong value bug foo is selected. bug 444444 Also, all QA boxes are orange due to this bug.";
        var test_comment_nourls_nobugs = "The quick brown fox jumped over the lazy dog. And then proceeded to drink its water all day long without bug getting in the way or https:// or anything.";
        var expected = test_comment_2urls_2bugs.split(' ').length + 200;
        var p = calcCommentScore(test_comment_2urls_2bugs);
        assert.equal(p, expected, "Make sure a comment with bugs and urls works");
        expected = test_comment_nourls_nobugs.split(' ').length;
        p = calcCommentScore(test_comment_nourls_nobugs);
        assert.equal(p, expected, "Make sure a comment with no bugs and no urls works");
    }

    function test_severity_scoring() {
        var s = calcSeverityScore('blocker');
        assert.equal(s, Math.pow(10,6), "Blocker should be a high number: 10^6");
        assert.equal(calcSeverityScore('normal'), Math.pow(10, 3), "normal severity should be 10^3"); 
        assert.equal(calcSeverityScore('enhancement'), Math.pow(10, 0), 'enhancement should be low: 10^0');
    }

    function test_reporter_scoring() {
        var reportermoz = {'email': 'ctalbert@mozilla.com'};
        var reporternotmoz = {'email': 'foo@bar.baz'};
        var reportermoz2 = {'email': 'ctalbert@mozilla.org'};
        var reportermofo = {'email': 'ctalbert@mozillafoundation.org'};

        assert.equal(calcReporterScore(reportermoz), 1.0);
        assert.equal(calcReporterScore(reporternotmoz), 0.0);
        assert.equal(calcReporterScore(reportermoz2), 1.0);
        assert.equal(calcReporterScore(reportermofo), 1.0)
    }

    function test_summary_scoring() {
        var s = {
            't1': { text: 'the quick brown fox jumped over the lazy dog', score: 9},
            't2': { text: 'the gfx d3d adapter is frigging busted on html', score: 159},
            't3': { text: 'the networking code does not like [e10s]', score: 157},
            't4': { text: '[mynewproject] is toast', score: 103}};

        for (var i in s) {
            assert.equal(calcSummaryScore(s[i].text), s[i].score);
        }
    }

    function test_prodcomp_scoring() {
        assert.equal(calcComponentScore('Core', 'DOM'), 1.0);
        assert.equal(calcComponentScore('Firefox For Android', 'General'), 0.5);
        assert.equal(calcComponentScore('foobar', 'foo'), 0.3);
        assert.equal(calcComponentScore('foobar', 'general'), 0.0);
    }

    test_comment_scoring();
    test_severity_scoring();
    test_reporter_scoring();
    test_summary_scoring();
    test_prodcomp_scoring();
    console.log('finished testing');
}
//test_me();