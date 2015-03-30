Bugbrain
============

This is a POC support vector machines classifier for bugzilla. It makes use of [node-svm](https://github.com/nicolaspanel/node-svm).

Run builddatamodel to build up a data model. I am using queries for the last few releases, so to find tracked bugs (class 1):
* bug in any component, where tracking for release in question == '+'
* And where bug filed since the beginning of nightly for oldest release in question (because often there are uplift bugs that block multiple releases)

Non-tracking bugs (class 0):
* bug in specific components (to limit the magnitude of the query) 
* bugs that were not tracking any releases in the above time frame
* bugs that were filed in the same time window as used above.

The REST calls eventually timed out, but it created a small dataset to use which is checked in here. To really get the full data, it may be necessary to modify this to take a JSON file, use a browser and download the JSON specifcally from the rest calls. The full raw queries are available in queries.txt.

To Run
==========
* To build a dataset: `node builddatamodel.js`
* To train: `node trainer.js`

Requirements
==============
Everything below needs to be installed via: `sudo npm install <x>`
* node-svm
* stringify-object
* request
* assert
* async

Current Work
==============
Currently, I can't get the system to train using unclassified data yet. I think this is because it does not currently understand the format of my training data. So testdata*.ds are my attempts at creating said testdata formats.

I also thought that maybe the model is not working well because not all the values were originally scaled from 0-1, so I made some changes to bring all the values into the same magnitude of scale. Hopefully that will help. You can see the original training data in original_training_data_* and the 0 to 1 data in 0_to_1_training*. Some of the values will be greater than 1 but I think that's ok since it's not going to be an order of magnitude greater than 1. (But I could be wrong).