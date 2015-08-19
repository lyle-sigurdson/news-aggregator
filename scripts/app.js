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
APP.Main = (function() {

  var LAZY_LOAD_THRESHOLD = 300;
  var $ = document.querySelector.bind(document);

  var stories = null;
  var storyStart = 0;
  var loadInProgress = false;
  var count = 100;
  var main = $('main');
  var inDetails = false;
  var localeData = {
    data: {
      intl: {
        locales: 'en-US'
      }
    }
  };

  var tmplStory = $('#tmpl-story').textContent;
  var tmplStoryDetails = $('#tmpl-story-details').textContent;
  var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

  if (typeof HandlebarsIntl !== 'undefined') {
    HandlebarsIntl.registerWith(Handlebars);
  } else {

    // Remove references to formatRelative, because Intl isn't supported.
    var intlRelative = /, {{ formatRelative time }}/;
    tmplStory = tmplStory.replace(intlRelative, '');
    tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
    tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
  }

  var storyTemplate =
      Handlebars.compile(tmplStory);
  var storyDetailsTemplate =
      Handlebars.compile(tmplStoryDetails);
  var storyDetailsCommentTemplate =
      Handlebars.compile(tmplStoryDetailsComment);

  function onStoryClick(details) {

    var storyDetails = $('sd-' + details.id);

    // Wait a little time then show the story details.
    setTimeout(showStory.bind(this, details.id), 60);

    // Create and append the story. A visual change...
    // perhaps that should be in a requestAnimationFrame?
    // And maybe, since they're all the same, I don't
    // need to make a new element every single time? I mean,
    // it inflates the DOM and I can only see one at once.
    if (!storyDetails) {

      if (details.url)
        details.urlobj = new URL(details.url);

      var comment;
      var commentsElement;
      var storyHeader;
      var storyContent;

      var storyDetailsHtml = storyDetailsTemplate(details);
      var kids = details.kids;
      var commentHtml = storyDetailsCommentTemplate({
        by: '', text: 'Loading comment...'
      });

      storyDetails = document.createElement('section');
      storyDetails.setAttribute('id', 'sd-' + details.id);
      storyDetails.classList.add('story-details');
      storyDetails.innerHTML = storyDetailsHtml;

      document.body.appendChild(storyDetails);

      commentsElement = storyDetails.querySelector('.js-comments');
      storyHeader = storyDetails.querySelector('.js-header');
      storyContent = storyDetails.querySelector('.js-content');

      var closeButton = storyDetails.querySelector('.js-close');
      closeButton.addEventListener('click', hideStory.bind(this, details.id));

      var headerHeight = storyHeader.getBoundingClientRect().height;
      storyContent.style.paddingTop = headerHeight + 'px';

      if (typeof kids === 'undefined')
        return;

      for (var k = 0; k < kids.length; k++) {

        comment = document.createElement('aside');
        comment.setAttribute('id', 'sdc-' + kids[k]);
        comment.classList.add('story-details__comment');
        comment.innerHTML = commentHtml;
        commentsElement.appendChild(comment);

        // Update the comment with the live data.
        APP.Data.getStoryComment(kids[k])
            .then(function(commentDetails) {
                var comment = commentsElement.querySelector('#sdc-' + commentDetails.id);
                commentDetails.time *= 1000;
                comment.innerHTML = storyDetailsCommentTemplate( commentDetails, localeData);
            })
            .done();
      }
    }

  }

  function showStory(id) {

    if (inDetails)
      return;

    inDetails = true;

    var storyDetails = $('#sd-' + id);
    var left = null;

    if (!storyDetails)
      return;

    storyDetails.classList.add('details-active');
  }

  function hideStory(id) {

    if (!inDetails)
      return;

    inDetails = false;

    var storyDetails = $('#sd-' + id);
    var left = 0;

    storyDetails.classList.remove('details-active');

    if (storyDetails.parentNode) {
        storyDetails.parentNode.removeChild(storyDetails);
    }
  }

  /**
   * Does this really add anything? Can we do this kind
   * of work in a cheaper way?
   */
  function colorizeAndScaleStories() {

    var storyElements = document.querySelectorAll('.story');

    // It does seem awfully broad to change all the
    // colors every time!
    for (var s = 0; s < storyElements.length; s++) {
      var scale = Math.abs(s / storyElements.length - 1);

      var story = storyElements[s];
      var score = story.querySelector('.story__score');
      var title = story.querySelector('.story__title');

      score.style.backgroundColor = 'hsl(42, ' + scale * 100 + '%, 50%)';
      if (scale > .65) {
          score.style.width = (scale * 40) + 'px';
          score.style.height = (scale * 40) + 'px';
          score.style.lineHeight = (scale * 40) + 'px';
      }
      if (scale > .45) {
          title.style.opacity = scale;
      }
    }
  }

  main.addEventListener('scroll', function() {

    var header = $('header');
    var headerTitles = header.querySelector('.header__title-wrapper');
    var scrollTop = main.scrollTop;
    var scrollTopCapped = Math.min(70, scrollTop);
    var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

    // Check if we need to load the next batch of stories.
    var loadThreshold = (main.scrollHeight - main.offsetHeight -
        LAZY_LOAD_THRESHOLD);

    // Add a shadow to the header.
    if (main.scrollTop > 70)
      document.body.classList.add('raised');
    else
      document.body.classList.remove('raised');

    header.style.height = (156 - scrollTopCapped) + 'px';
    headerTitles.style.webkitTransform = scaleString;
    headerTitles.style.transform = scaleString;

    if (scrollTop > loadThreshold) {
      loadStoryBatch();
    }
  });

  function loadStoryBatch() {
    var end = Math.min(storyStart + count, stories.length),
        fragment = document.createDocumentFragment(),
        i,
        batch = [];

    if (loadInProgress) {
        return;
    }

    loadInProgress = true;

    for (i = storyStart; i < end; i++) {
        batch.push(APP.Data.getStoryById(stories[i]));
    }

    if (!batch.length) {
        return;
    }

    storyStart += count;

    return Q.allSettled(batch)
        .then(function (results) {
            return results.reduce(function (prev, curr, i) {
                var story = document.createElement('div'),
                    key = parseInt(stories[i], 10);

                story.classList.add('story');
                story.classList.add('clickable');
                story.setAttribute('id', 's-' + key);
                story.addEventListener('click', onStoryClick.bind(this, curr.value));
                story.innerHTML = storyTemplate({
                  title: curr.value.title,
                  score: curr.value.score,
                  by: curr.value.by,
                  time: curr.value.time * 1000
                });

                fragment.appendChild(story);

                return fragment;
            })
        })
        .then(function (fragment) {
            return main.appendChild(fragment);
        })
        .catch(function (err) {
            console.log(err.stack);
        })
        .finally(function () {
            loadInProgress = false;
        });
  }

  // Bootstrap in the stories.
  APP.Data.getTopStories()
    .then(function (data) {
     stories = data;
     return loadStoryBatch();
    })
  .then(function () {
    colorizeAndScaleStories();
    main.classList.remove('loading');
  })
  .catch(function (err) {
    console.log(err)
  }).
  done();
})();
