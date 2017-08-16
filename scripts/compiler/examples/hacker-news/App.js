"use strict";

const React = require('React');
const HeaderBar = require('HeaderBar');
const StoryList = require('StoryList');

function App({ stories }) {
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
          <HeaderBar />
          <tr height="10" />
          <StoryList stories={stories} />
        </tbody>
      </table>
    </center>
  );
}

module.exports = App;
