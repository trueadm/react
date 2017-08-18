'use strict';

require('React');

function StoryList(props) {
  return <tr>
      <td>
        <table cellPadding="0" cellSpacing="0" className="itemlist">
          <tbody>
            {props.stories.map(Unknown)}
          </tbody>
        </table>
      </td>
    </tr>;
}

function App(props) {
  return <center>
      <table id="hnmain" border="0" cellPadding="0" cellSpacing="0" width="85%" style={{
      "backgroundColor": "#f6f6ef"
    }}>
        <tbody>
          {props.stories.foo.length > 0 ? [<tr style={{
          "backgroundColor": "#222"
        }}>
      <table style={{
            "padding": 4
          }} width="100%" cellSpacing="0" cellPadding="0">
        <tbody>
          <tr>
            <td style={{
                  "width": 18,
                  "paddingRight": 4
                }}>
              <a href="#">
                <img src="logo.png" width="16" height="16" style={{
                      "border": "1px solid #00d8ff"
                    }} />
              </a>
            </td>
            <td style={{
                  "lineHeight": "12pt"
                }} height="10">
              <span className="pagetop">
                <b className="hnname">React HN Benchmark</b>
                <a href="#">new</a>
                 | 
                <a href="#">comments</a>
                 | 
                <a href="#">show</a>
                 | 
                <a href="#">ask</a>
                 | 
                <a href="#">jobs</a>
                 | 
                <a href="#">submit</a>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </tr>, <tr height="10" />, <StoryList stories={{
          "foo": props.stories.foo
        }} limit={10} />] : null}
        </tbody>
      </table>
    </center>;
}

var App_1 = App;

var compiledBundle = App_1;

module.exports = compiledBundle;
