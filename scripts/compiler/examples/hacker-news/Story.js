"use strict";

const React = require('React');

function timeAge(time) {
  const now = new Date().getTime() / 1000;
  const minutes = (now - time) / 60;

  if (minutes < 60) {
    return Math.round(minutes) + ' minutes ago';
  }
  return Math.round(minutes / 60) + ' hours ago';
}

function getHostUrl(url) {
  return (url + '')
    .replace('https://', '')
    .replace('http://', '')
    .split('/')[0]
}

function Story({ story, rank }) {
  return [
    <tr className="athing">
      <td
        style={{
          verticalAlign: 'top',
          textAlign: 'right',
        }}
        className="title">
        <span className="rank">{`${rank}.`}</span>
      </td>
      <td
        className="votelinks"
        style={{
          verticalAlign: 'top',
        }}>
        <center>
          <a href="#">
            <div className="votearrow" titl="upvote" />
          </a>
        </center>
      </td>
      <td className="title">
        <a href="#" className="storylink">{story.title}</a>
        {
          story.url ? (
            <span className="sitebit comhead">
              {' ('}<a href="#">{getHostUrl(story.url)}</a>)
            </span>
          ) : null
        }
      </td>
    </tr>,
    <tr>
      <td colSpan="2" />
      <td className="subtext">
        <span className="score">{`${story.score} points`}</span>
        {' by '} 
        <a href="#" className="hnuser">{story.by}</a>
        {' '}
        <span className="age">
          <a href="#">{timeAge(story.time)}</a>
        </span>
        {' | '} 
        <a href="#">hide</a>
        {' | '} 
        <a href="#">{`${ story.descendants || 0 } comments`}</a>
      </td>
    </tr>,
    <tr
      style={{
        height: 5,
      }}
      className="spacer" />,
  ];
}

module.exports = Story;
