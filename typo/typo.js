/* globals chrome: false */
/* globals __dirname: false */
/* globals require: false */
/* globals Buffer: false */
/* globals module: false */

/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style 
 * dictionaries.
 */

var Typo;

(function () {
"use strict";

/**
 * Typo constructor.
 *
 * @param {String} [dictionary] The locale code of the dictionary being used. e.g.,
 *                              "en_US". This is only used to auto-load dictionaries.
 * @param {String} [affData]    The data from the dictionary's .aff file. If omitted
 *                              and Typo.js is being used in a Chrome extension, the .aff
 *                              file will be loaded automatically from
 *                              lib/typo/dictionaries/[dictionary]/[dictionary].aff
 *                              In other environments, it will be loaded from
 *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].aff
 * @param {String} [wordsData]  The data from the dictionary's .dic file. If omitted
 *                              and Typo.js is being used in a Chrome extension, the .dic
 *                              file will be loaded automatically from
 *                              lib/typo/dictionaries/[dictionary]/[dictionary].dic
 *                              In other environments, it will be loaded from
 *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].dic
 * @param {Object} [settings]   Constructor settings. Available properties are:
 *                              {String} [dictionaryPath]: path to load dictionary from in non-chrome
 *                              environment.
 *                              {Object} [flags]: flag information.
 *                              {Boolean} [asyncLoad]: If true, affData and wordsData will be loaded
 *                              asynchronously.
 *                              {Function} [loadedCallback]: Called when both affData and wordsData
 *                              have been loaded. Only used if asyncLoad is set to true. The parameter
 *                              is the instantiated Typo object.
 *
 * @returns {Typo} A Typo object.
 */

Typo = function (dictionary, affData, wordsData, settings) {
    settings = settings || {};

    this.dictionary = null;
    
    this.rules = {};
    this.dictionaryTable = {};
    
    this.compoundRules = [];
    this.compoundRuleCodes = {};
    
    this.replacementTable = [];
    
    this.flags = settings.flags || {}; 
    
    this.memoized = {};

    this.loaded = false;
    
    var self = this;
    
    var path;
    
    // Loop-control variables.
    var i, j, _len, _jlen;
    
    if (dictionary) {
        self.dictionary = dictionary;
        
        // If the data is preloaded, just setup the Typo object.
        if (affData && wordsData) {
            setup();
        }
        // Loading data for Chrome extensions.
        else if (typeof window !== 'undefined' && 'chrome' in window && 'extension' in window.chrome && 'getURL' in window.chrome.extension) {
            if (settings.dictionaryPath) {
                path = settings.dictionaryPath;
            }
            else {
                path = "typo/dictionaries";
            }
            
            if (!affData) readDataFile(chrome.extension.getURL(path + "/" + dictionary + "/" + dictionary + ".aff"), setAffData);
            if (!wordsData) readDataFile(chrome.extension.getURL(path + "/" + dictionary + "/" + dictionary + ".dic"), setWordsData);
        }
        else {
            if (settings.dictionaryPath) {
                path = settings.dictionaryPath;
            }
            else if (typeof __dirname !== 'undefined') {
                path = __dirname + '/dictionaries';
            }
            else {
                path = './dictionaries';
            }
            
            if (!affData) readDataFile(path + "/" + dictionary + "/" + dictionary + ".aff", setAffData);
            if (!wordsData) readDataFile(path + "/" + dictionary + "/" + dictionary + ".dic", setWordsData);
        }
    }
    
    function readDataFile(url, setFunc) {
        var response = self._readFile(url, null, settings.asyncLoad);
        
        if (settings.asyncLoad) {
            response.then(function(data) {
                setFunc(data);
            }).catch(function(error) {
                console.error('Failed to load file:', error);
            });
        }
        else {
            setFunc(response);
        }
    }

    function setAffData(data) {
        affData = data;

        if (wordsData) {
            setup();
        }
    }

    function setWordsData(data) {
        wordsData = data;

        if (affData) {
            setup();
        }
    }

    function setup() {
        self.rules = self._parseAFF(affData);
        
        // Save the rule codes that are used in compound rules.
        self.compoundRuleCodes = {};
        
        for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
            var rule = self.compoundRules[i];
            
            for (j = 0, _jlen = rule.length; j < _jlen; j++) {
                self.compoundRuleCodes[rule[j]] = [];
            }
        }
        
        // If we add this ONLYINCOMPOUND flag to self.compoundRuleCodes, then _parseDIC
        // will do the work of saving the list of words that are compound-only.
        if ("ONLYINCOMPOUND" in self.flags) {
            self.compoundRuleCodes[self.flags.ONLYINCOMPOUND] = [];
        }
        
        self.dictionaryTable = self._parseDIC(wordsData);
        
        // Get rid of any codes from the compound rule codes that are never used 
        // (or that were special regex characters).  Not especially necessary... 
        for (i in self.compoundRuleCodes) {
            if (self.compoundRuleCodes[i].length === 0) {
                delete self.compoundRuleCodes[i];
            }
        }
        
        // Build the full regular expressions for each compound rule.
        // I have a feeling (but no confirmation yet) that this method of 
        // testing for compound words is probably slow.
        for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
            var ruleText = self.compoundRules[i];
            
            var expressionText = "";
            
            for (j = 0, _jlen = ruleText.length; j < _jlen; j++) {
                var character = ruleText[j];
                
                if (character in self.compoundRuleCodes) {
                    expressionText += "(" + self.compoundRuleCodes[character].join("|") + ")";
                }
                else {
                    expressionText += character;
                }
            }
            
            self.compoundRules[i] = new RegExp(expressionText, "i");
        }
        
        self.loaded = true;
        
        if (settings.asyncLoad && settings.loadedCallback) {
            settings.loadedCallback(self);
        }
    }
    
    return this;
};

Typo.prototype._readFile = function (path, charset, async) {
    charset = charset || "utf8";

    if (typeof XMLHttpRequest !== 'undefined') {
        var promise;
        var req = new XMLHttpRequest();
        req.open("GET", path, true); // Ensure this is set to true for asynchronous
        if (async) {
            promise = new Promise(function(resolve, reject) {
                req.onload = function() {
                    if (req.status === 200 || req.status === 0) {
                        resolve(req.responseText);
                    } else {
                        reject(new Error(req.statusText));
                    }
                };
                req.onerror = function() {
                    reject(new Error(req.statusText));
                };
            });
        }

        if (req.overrideMimeType)
            req.overrideMimeType("text/plain; charset=" + charset);

        req.send(null);

        return async ? promise : req.responseText;
    } else if (typeof require !== 'undefined') {
        // Node.js
        var fs = require("fs");
        try {
            if (fs.existsSync(path)) {
                return fs.readFileSync(path, charset);
            } else {
                console.log("Path " + path + " does not exist.");
            }
        } catch (e) {
            console.log(e);
            return '';
        }
    }
};
	
	/**
	 * Read the contents of a file.
	 * 
	 * @param {String} path The path (relative) to the file.
	 * @param {String} [charset="ISO8859-1"] The expected charset of the file
	 * @param {Boolean} async If true, the file will be read asynchronously. For node.js this does nothing, all
	 *        files are read synchronously.
	 * @returns {String} The file data if async is false, otherwise a promise object. If running node.js, the data is
	 *          always returned.
	 */
	
	_readFile : function (path, charset, async) {
    charset = charset || "utf8";

    if (typeof XMLHttpRequest !== 'undefined') {
        var promise;
        var req = new XMLHttpRequest();
        req.open("GET", path, true); // Ensure this is set to true for asynchronous
        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status === 200 || req.status === 0) {
                    if (async) {
                        resolve(req.responseText);
                    } else {
                        return req.responseText;
                    }
                } else {
                    if (async) {
                        reject(req.statusText);
                    } else {
                        console.error("Failed to load file: " + path);
                        return '';
                    }
                }
            }
        };
        req.send(null);

        return async ? promise : req.responseText;
    }
    else if (typeof require !== 'undefined') {
        // Node.js
        var fs = require("fs");

        try {
            if (fs.existsSync(path)) {
                return fs.readFileSync(path, charset);
            }
            else {
                console.log("Path " + path + " does not exist.");
            }
        } catch (e) {
            console.log(e);
            return '';
        }
    }
},
	
	/**
	 * Parse the rules out from a .aff file.
	 *
	 * @param {String} data The contents of the affix file.
	 * @returns object The rules from the file.
	 */
	
	_parseAFF : function (data) {
		var rules = {};
		
		var line, subline, numEntries, lineParts;
		var i, j, _len, _jlen;
		
		var lines = data.split(/\r?\n/);
		
		for (i = 0, _len = lines.length; i < _len; i++) {
			// Remove comment lines
			line = this._removeAffixComments(lines[i]);
			line = line.trim();
			
			if ( ! line ) {
				continue;
			}
			
			var definitionParts = line.split(/\s+/);
			
			var ruleType = definitionParts[0];
			
			if (ruleType == "PFX" || ruleType == "SFX") {
				var ruleCode = definitionParts[1];
				var combineable = definitionParts[2];
				numEntries = parseInt(definitionParts[3], 10);
				
				var entries = [];
				
				for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					subline = lines[j];
					
					lineParts = subline.split(/\s+/);
					var charactersToRemove = lineParts[2];
					
					var additionParts = lineParts[3].split("/");
					
					var charactersToAdd = additionParts[0];
					if (charactersToAdd === "0") charactersToAdd = "";
					
					var continuationClasses = this.parseRuleCodes(additionParts[1]);
					
					var regexToMatch = lineParts[4];
					
					var entry = {};
					entry.add = charactersToAdd;
					
					if (continuationClasses.length > 0) entry.continuationClasses = continuationClasses;
					
					if (regexToMatch !== ".") {
						if (ruleType === "SFX") {
							entry.match = new RegExp(regexToMatch + "$");
						}
						else {
							entry.match = new RegExp("^" + regexToMatch);
						}
					}
					
					if (charactersToRemove != "0") {
						if (ruleType === "SFX") {
							entry.remove = new RegExp(charactersToRemove  + "$");
						}
						else {
							entry.remove = charactersToRemove;
						}
					}
					
					entries.push(entry);
				}
				
				rules[ruleCode] = { "type" : ruleType, "combineable" : (combineable == "Y"), "entries" : entries };
				
				i += numEntries;
			}
			else if (ruleType === "COMPOUNDRULE") {
				numEntries = parseInt(definitionParts[1], 10);
				
				for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
					line = lines[j];
					
					lineParts = line.split(/\s+/);
					this.compoundRules.push(lineParts[1]);
				}
				
				i += numEntries;
			}
			else if (ruleType === "REP") {
				lineParts = line.split(/\s+/);
				
				if (lineParts.length === 3) {
					this.replacementTable.push([ lineParts[1], lineParts[2] ]);
				}
			}
			else {
				// ONLYINCOMPOUND
				// COMPOUNDMIN
				// FLAG
				// KEEPCASE
				// NEEDAFFIX
				
				this.flags[ruleType] = definitionParts[1];
			}
		}
		
		return rules;
	},
	
	/**
	 * Removes comments.
	 *
	 * @param {String} data A line from an affix file.
	 * @return {String} The cleaned-up line.
	 */
	
	_removeAffixComments : function (line) {
		// This used to remove any string starting with '#' up to the end of the line,
		// but some COMPOUNDRULE definitions include '#' as part of the rule.
		// So, only remove lines that begin with a comment, optionally preceded by whitespace.
		if ( line.match( /^\s*#/, "" ) ) {
			return '';
		}
		
		return line;
	},
	
	/**
	 * Parses the words out from the .dic file.
	 *
	 * @param {String} data The data from the dictionary file.
	 * @returns object The lookup table containing all of the words and
	 *                 word forms from the dictionary.
	 */
	
	_parseDIC : function (data) {
		data = this._removeDicComments(data);
		
		var lines = data.split(/\r?\n/);
		var dictionaryTable = {};
		
		function addWord(word, rules) {
			// Some dictionaries will list the same word multiple times with different rule sets.
			if (!dictionaryTable.hasOwnProperty(word)) {
				dictionaryTable[word] = null;
			}
			
			if (rules.length > 0) {
				if (dictionaryTable[word] === null) {
					dictionaryTable[word] = [];
				}

				dictionaryTable[word].push(rules);
			}
		}
		
		// The first line is the number of words in the dictionary.
		for (var i = 1, _len = lines.length; i < _len; i++) {
			var line = lines[i];
			
			if (!line) {
				// Ignore empty lines.
				continue;
			}

			var parts = line.split("/", 2);
			
			var word = parts[0];

			// Now for each affix rule, generate that form of the word.
			if (parts.length > 1) {
				var ruleCodesArray = this.parseRuleCodes(parts[1]);
				
				// Save the ruleCodes for compound word situations.
				if (!("NEEDAFFIX" in this.flags) || ruleCodesArray.indexOf(this.flags.NEEDAFFIX) == -1) {
					addWord(word, ruleCodesArray);
				}
				
				for (var j = 0, _jlen = ruleCodesArray.length; j < _jlen; j++) {
					var code = ruleCodesArray[j];
					
					var rule = this.rules[code];
					
					if (rule) {
						var newWords = this._applyRule(word, rule);
						
						for (var ii = 0, _iilen = newWords.length; ii < _iilen; ii++) {
							var newWord = newWords[ii];
							
							addWord(newWord, []);
							
							if (rule.combineable) {
								for (var k = j + 1; k < _jlen; k++) {
									var combineCode = ruleCodesArray[k];
									
									var combineRule = this.rules[combineCode];
									
									if (combineRule) {
										if (combineRule.combineable && (rule.type != combineRule.type)) {
											var otherNewWords = this._applyRule(newWord, combineRule);
											
											for (var iii = 0, _iiilen = otherNewWords.length; iii < _iiilen; iii++) {
												var otherNewWord = otherNewWords[iii];
												addWord(otherNewWord, []);
											}
										}
									}
								}
							}
						}
					}
					
					if (code in this.compoundRuleCodes) {
						this.compoundRuleCodes[code].push(word);
					}
				}
			}
			else {
				addWord(word.trim(), []);
			}
		}
		
		return dictionaryTable;
	},
	
	
	/**
	 * Removes comment lines and then cleans up blank lines and trailing whitespace.
	 *
	 * @param {String} data The data from a .dic file.
	 * @return {String} The cleaned-up data.
	 */
	
	_removeDicComments : function (data) {
		// I can't find any official documentation on it, but at least the de_DE
		// dictionary uses tab-indented lines as comments.
		
		// Remove comments
		data = data.replace(/^\t.*$/mg, "");
		
		return data;
	},
	
	parseRuleCodes : function (textCodes) {
		if (!textCodes) {
			return [];
		}
		else if (!("FLAG" in this.flags)) {
			// The flag symbols are single characters
			return textCodes.split("");
		}
		else if (this.flags.FLAG === "long") {
			// The flag symbols are two characters long.
			var flags = [];
			
			for (var i = 0, _len = textCodes.length; i < _len; i += 2) {
				flags.push(textCodes.substr(i, 2));
			}
			
			return flags;
		}
		else if (this.flags.FLAG === "num") {
			// The flag symbols are a CSV list of numbers.
			return textCodes.split(",");
		}
		else if (this.flags.FLAG === "UTF-8") {
			// The flags are single UTF-8 characters.
			// @see https://github.com/cfinke/Typo.js/issues/57
			return Array.from(textCodes);
		}
		else {
			// It's possible that this fallback case will not work for all FLAG values,
			// but I think it's more likely to work than not returning anything at all.
			return textCodes.split("");
		}
	},
	
	/**
	 * Applies an affix rule to a word.
	 *
	 * @param {String} word The base word.
	 * @param {Object} rule The affix rule.
	 * @returns {String[]} The new words generated by the rule.
	 */
	
	_applyRule : function (word, rule) {
		var entries = rule.entries;
		var newWords = [];
		
		for (var i = 0, _len = entries.length; i < _len; i++) {
			var entry = entries[i];
			
			if (!entry.match || word.match(entry.match)) {
				var newWord = word;
				
				if (entry.remove) {
					newWord = newWord.replace(entry.remove, "");
				}
				
				if (rule.type === "SFX") {
					newWord = newWord + entry.add;
				}
				else {
					newWord = entry.add + newWord;
				}
				
				newWords.push(newWord);
				
				if ("continuationClasses" in entry) {
					for (var j = 0, _jlen = entry.continuationClasses.length; j < _jlen; j++) {
						var continuationRule = this.rules[entry.continuationClasses[j]];
						
						if (continuationRule) {
							newWords = newWords.concat(this._applyRule(newWord, continuationRule));
						}
						/*
						else {
							// This shouldn't happen, but it does, at least in the de_DE dictionary.
							// I think the author mistakenly supplied lower-case rule codes instead 
							// of upper-case.
						}
						*/
					}
				}
			}
		}
		
		return newWords;
	},
	
	/**
	 * Checks whether a word or a capitalization variant exists in the current dictionary.
	 * The word is trimmed and several variations of capitalizations are checked.
	 * If you want to check a word without any changes made to it, call checkExact()
	 *
	 * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript re:trimming function
	 *
	 * @param {String} aWord The word to check.
	 * @returns {Boolean}
	 */
	
	check : function (aWord) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}
		
		if (!aWord) {
			return false;
		}
		
		// Remove leading and trailing whitespace
		var trimmedWord = aWord.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
		
		if (this.checkExact(trimmedWord)) {
			return true;
		}
		
		// The exact word is not in the dictionary.
		if (trimmedWord.toUpperCase() === trimmedWord) {
			// The word was supplied in all uppercase.
			// Check for a capitalized form of the word.
			var capitalizedWord = trimmedWord[0] + trimmedWord.substring(1).toLowerCase();
			
			if (this.hasFlag(capitalizedWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}
			
			if (this.checkExact(capitalizedWord)) {
				// The all-caps word is a capitalized word spelled correctly.
				return true;
			}

			if (this.checkExact(trimmedWord.toLowerCase())) {
				// The all-caps is a lowercase word spelled correctly.
				return true;
			}
		}
		
		var uncapitalizedWord = trimmedWord[0].toLowerCase() + trimmedWord.substring(1);
		
		if (uncapitalizedWord !== trimmedWord) {
			if (this.hasFlag(uncapitalizedWord, "KEEPCASE")) {
				// Capitalization variants are not allowed for this word.
				return false;
			}
			
			// Check for an uncapitalized form
			if (this.checkExact(uncapitalizedWord)) {
				// The word is spelled correctly but with the first letter capitalized.
				return true;
			}
		}
		
		return false;
	},
	
	/**
	 * Checks whether a word exists in the current dictionary.
	 *
	 * @param {String} word The word to check.
	 * @returns {Boolean}
	 */
	
	checkExact : function (word) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		var ruleCodes = this.dictionaryTable[word];
		
		var i, _len;
		
		if (typeof ruleCodes === 'undefined') {
			// Check if this might be a compound word.
			if ("COMPOUNDMIN" in this.flags && word.length >= this.flags.COMPOUNDMIN) {
				for (i = 0, _len = this.compoundRules.length; i < _len; i++) {
					if (word.match(this.compoundRules[i])) {
						return true;
					}
				}
			}
		}
		else if (ruleCodes === null) {
			// a null (but not undefined) value for an entry in the dictionary table
			// means that the word is in the dictionary but has no flags.
			return true;
		}
		else if (typeof ruleCodes === 'object') { // this.dictionary['hasOwnProperty'] will be a function.
			for (i = 0, _len = ruleCodes.length; i < _len; i++) {
				if (!this.hasFlag(word, "ONLYINCOMPOUND", ruleCodes[i])) {
					return true;
				}
			}
		}

		return false;
	},
	
	/**
	 * Looks up whether a given word is flagged with a given flag.
	 *
	 * @param {String} word The word in question.
	 * @param {String} flag The flag in question.
	 * @return {Boolean}
	 */
	 
	hasFlag : function (word, flag, wordFlags) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		if (flag in this.flags) {
			if (typeof wordFlags === 'undefined') {
				wordFlags = Array.prototype.concat.apply([], this.dictionaryTable[word]);
			}
			
			if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
				return true;
			}
		}
		
		return false;
	},
	
	/**
	 * Returns a list of suggestions for a misspelled word.
	 *
	 * @see http://www.norvig.com/spell-correct.html for the basis of this suggestor.
	 * This suggestor is primitive, but it works.
	 *
	 * @param {String} word The misspelling.
	 * @param {Number} [limit=5] The maximum number of suggestions to return.
	 * @returns {String[]} The array of suggestions.
	 */
	
	alphabet : "",
	
	suggest : function (word, limit) {
		if (!this.loaded) {
			throw "Dictionary not loaded.";
		}

		limit = limit || 5;

		if (this.memoized.hasOwnProperty(word)) {
			var memoizedLimit = this.memoized[word]['limit'];
			if (limit <= memoizedLimit) {
				return this.memoized[word][limit];
			}
		}
		
		var self = this;
		
		function editDistance(a, b) {
			if (a.length === 0) return b.length; 
			if (b.length === 0) return a.length; 
		
			var matrix = [];
		
			// increment along the first column of each row
			var i;
			for (i = 0; i <= b.length; i++) {
				matrix[i] = [i];
			}
		
			// increment each column in the first row
			var j;
			for (j = 0; j <= a.length; j++) {
				matrix[0][j] = j;
			}
		
			// Fill in the rest of the matrix
			for (i = 1; i <= b.length; i++) {
				for (j = 1; j <= a.length; j++) {
					if (b.charAt(i-1) === a.charAt(j-1)) {
						matrix[i][j] = matrix[i-1][j-1];
					} else {
						matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
							Math.min(matrix[i][j-1] + 1, // insertion
							matrix[i-1][j] + 1)); // deletion
					}
				}
			}
		
			return matrix[b.length][a.length];
		}
		
		/**
		 * Comparator function for suggestions.
		 */
		 
		function compareScores(a, b) {
			if (a.score < b.score) {
				return -1;
			}
			else if (a.score > b.score) {
				return 1;
			}
			else {
				if (a.word < b.word) {
					return -1;
				}
				else if (a.word > b.word) {
					return 1;
				}
			}
			
			return 0;
		}
		
		// Check the replacement table.
		var i, _len, replacement;
		var replacements = this.replacementTable;
		
		var searchTerm = word;
		
		for (i = 0, _len = replacements.length; i < _len; i++) {
			replacement = replacements[i];
			
			if (searchTerm.indexOf(replacement[0]) !== -1) {
				var correctedWord = searchTerm.replace(replacement[0], replacement[1]);
				
				if (this.check(correctedWord)) {
					return [ correctedWord ];
				}
			}
		}
		
		if (this.check(word)) {
			return [];
		}
		
		var currentLevel = [ word ];
		var suggestions = [];
		var seen = new Set();
		
		seen.add(word);
		
		var maxEditDistance = 2;
		
		// Don't suggest words that differ in length by more than maxEditDistance
		var maxLength = word.length + maxEditDistance;
		var minLength = word.length - maxEditDistance;
		
		// Iterate through all the levels of the levenshtein distance.
		for (var currentEditDistance = 0; currentEditDistance < maxEditDistance; currentEditDistance++) {
			var newCurrentLevel = [];
			
			// Save any suggestions from the current level.
			for (i = 0, _len = currentLevel.length; i < _len; i++) {
				var currentWord = currentLevel[i];
				
				var edits = self.edits(currentWord);
				
				edits.forEach(function(edit) {
					if (!seen.has(edit)) {
						seen.add(edit);
						
						if (edit.length <= maxLength && edit.length >= minLength) {
							if (self.check(edit)) {
								var score = editDistance(word, edit);
								
								if (score <= maxEditDistance) {
									suggestions.push({ word: edit, score: score });
								}
							}
							
							newCurrentLevel.push(edit);
						}
					}
				});
			}
			
			currentLevel = newCurrentLevel;
		}
		
		suggestions.sort(compareScores);
		
		var results = suggestions.map(function(suggestion) {
			return suggestion.word;
		});
		
		// Memoize the result.
		this.memoized[word] = this.memoized[word] || {};
		this.memoized[word][limit] = results.slice(0, limit);
		this.memoized[word]['limit'] = limit;
		
		return results.slice(0, limit);
	},
	
	/**
	 * Returns a list of all the possible one-edit words for a given word.
	 *
	 * @param {String} word The word to split.
	 * @returns {String[]} The array of words.
	 */
	
	edits : function (word) {
		var i, _len;
		var results = [];
		
		// Delete each character.
		for (i = 0, _len = word.length; i < _len; i++) {
			results.push(word.substring(0, i) + word.substring(i + 1));
		}
		
		// Transpose each adjacent character.
		for (i = 0, _len = word.length - 1; i < _len; i++) {
			results.push(word.substring(0, i) + word.charAt(i + 1) + word.charAt(i) + word.substring(i + 2));
		}
		
		// Replace each character with each letter in the alphabet.
		for (i = 0, _len = word.length; i < _len; i++) {
			for (var j = 0, _jlen = this.alphabet.length; j < _jlen; j++) {
				results.push(word.substring(0, i) + this.alphabet[j] + word.substring(i + 1));
			}
		}
		
		// Add each letter in the alphabet in each position.
		for (i = 0, _len = word.length + 1; i < _len; i++) {
			for (var k = 0, _klen = this.alphabet.length; k < _klen; k++) {
				results.push(word.substring(0, i) + this.alphabet[k] + word.substring(i));
			}
		}
		
		return results;
	}
};
})();
