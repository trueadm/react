'use strict';

const React = require('React');
const HeaderBar = require('HeaderBar');
const StoryList = require('StoryList');
const PropTypes = require('PropTypes');

class AppBody extends React.Component {
  getDefaultProps() {
    return {
      storyLimit: 10,
    };
  }
  render() {
    return [
      <HeaderBar />,
      <tr height="10" />,
      <StoryList stories={this.props.stories} limit={this.props.storyLimit} />,
    ];
  }
}

function App({stories}) {
  return (
    <center>
      <table
        id="hnmain"
        border="0"
        cellPadding="0"
        cellSpacing="0"
        width="85%"
        style={{
          backgroundColor: '#f6f6ef',
        }}>
        <tbody>
          {stories.length > 0 ? <AppBody stories={stories} /> : null}
        </tbody>
      </table>
    </center>
  );
}

App.propTypes = {
  stories: PropTypes.array.isRequired,
};

module.exports = App;
