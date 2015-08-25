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
  var slider = document.getElementById('slider');

  var header = $('header');
  var headerTitles = document.querySelector('.header__title-wrapper');
  var stories = null;
  var storyStart = 0;
  var loadInProgress = false;
  var count = 25;
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
      console.log(details);
  // Open the slider.
    slider.classList.toggle('open');

    // Show the story details and comments.
    APP.Data.getStoryById(details.id)
        .then(function (story) {
            story.time *= 1000;

            slider.innerHTML = storyDetailsTemplate(story);

            slider.getElementsByTagName('button')[0].addEventListener('click', function (e) {
                slider.classList.toggle('open');
            });

            if (story.kids) {
                return Q.allSettled(story.kids.map(function (kidId) {
                    return APP.Data.getStoryComment(kidId);
                }));
            } else {
                return [];
            }
        })
        .then(function (kids) {
            var fragment = document.createDocumentFragment();

            kids.forEach(function (kid) {
                var section = document.createElement('section'),
                    p = document.createElement('p'),
                    div = document.createElement('div');

                section.classList.add('story-details__content');

                p.classList.add('story-details-comment__author');
                p.textContent = 'by ' + kid.value.by + (kid.value.time ? ' ' + kid.value.time : '');

                div.classList.add('story-details-comment__text');
                div.innerHTML = kid.value.text;

                section.appendChild(p);
                section.appendChild(div);

                fragment.appendChild(section);
            });

            window.requestAnimationFrame(function () {
                slider.appendChild(fragment);
            });
        })
        .catch (function (err) {
            console.log(err);
        })
        .done();
  }



  main.addEventListener('scroll', function() {
    var scrollTop = main.scrollTop;
    var scrollTopCapped = Math.min(70, scrollTop);
    var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

    // Check if we need to load the next batch of stories.
    var loadThreshold = (main.scrollHeight - main.offsetHeight -
        LAZY_LOAD_THRESHOLD);

    // Add a shadow to the header.
    if (main.scrollTop > 70)
      document.body.classList.toggle('raised');

    if (scrollTop < 70) {
      header.style.height = (156 - scrollTopCapped) + 'px';
      headerTitles.style.webkitTransform = scaleString;
      headerTitles.style.transform = scaleString;
    }

    if (scrollTop > loadThreshold) {
      loadStoryBatch();
    }
  });

  function loadStoryBatch(options) {
    var end = Math.min(storyStart + count, stories.length),
        fragment = document.createDocumentFragment(),
        i,
        batch = [];

    options = options || {};

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
                    key = parseInt(stories[i], 10),
                    score,
                    title,
                    scale;

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

                if (options.colorize) {
                  scale = Math.abs(i - count) / count;
                  score = story.querySelector('.story__score');
                  title = story.querySelector('.story__title');
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
     return loadStoryBatch({ colorize: true });
    })
  .then(function () {
    main.classList.remove('loading');
  })
  .catch(function (err) {
    console.log(err.stack)
  }).
  done();
})();
