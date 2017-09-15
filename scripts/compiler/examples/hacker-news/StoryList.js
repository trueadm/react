'use strict';

const React = require('React');
const Story = require('Story');

function StoryList({stories}) {
  return (
    <tr>
      <td>
        <table cellPadding="0" cellSpacing="0" className="itemlist">
          <tbody>
            {stories.map((story, i) => (
              <Story story={story} rank={++i} key={story.id} />
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

module.exports = StoryList;
