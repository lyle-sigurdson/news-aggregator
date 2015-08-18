/*jslint browser: true */
/*global APP, Q */
/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Data = (function() {

  var HN_API_BASE = 'https://hacker-news.firebaseio.com';
  var HN_TOPSTORIES_URL = HN_API_BASE + '/v0/topstories.json';
  var HN_STORYDETAILS_URL = HN_API_BASE + '/v0/item/[ID].json';

  function request(url) {
    var defer = Q.defer(),
        xhr = new XMLHttpRequest();

    xhr.addEventListener('error', function () {
        defer.reject(xhr.statusText);
    });

    xhr.addEventListener('load', function() {
        defer.resolve(xhr.response);
    });

    xhr.responseType = 'json';
    xhr.open('GET', url, true);
    xhr.send();

    return defer.promise;
  }

  function getTopStories() {
    return request(HN_TOPSTORIES_URL);
  }

  function getStoryById(id) {
    var storyURL = HN_STORYDETAILS_URL.replace(/\[ID\]/, id);
    return request(storyURL);
  }

  function getStoryComment(id, callback) {
    var storyCommentURL = HN_STORYDETAILS_URL.replace(/\[ID\]/, id);
    return request(storyCommentURL);
  }


  return {
    getTopStories: getTopStories,
    getStoryById: getStoryById,
    getStoryComment: getStoryComment
  };
}());
