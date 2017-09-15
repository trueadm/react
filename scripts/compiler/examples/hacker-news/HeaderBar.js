'use strict';

const React = require('React');

function HeaderBar(props) {
  return (
    <tr style={{backgroundColor: '#222'}}>
      <table
        style={{
          padding: 4,
        }}
        width="100%"
        cellSpacing="0"
        cellPadding="0">
        <tbody>
          <tr>
            <td style={{width: 18, paddingRight: 4}}>
              <a href="#">
                <img
                  src="logo.png"
                  width="16"
                  height="16"
                  style={{
                    border: '1px solid #00d8ff',
                  }}
                />
              </a>
            </td>
            <td style={{lineHeight: '12pt'}} height="10">
              <span className="pagetop">
                <b className="hnname">{props.title}</b>
                <a href="#">new</a>
                {' | '}
                <a href="#">comments</a>
                {' | '}
                <a href="#">show</a>
                {' | '}
                <a href="#">ask</a>
                {' | '}
                <a href="#">jobs</a>
                {' | '}
                <a href="#">submit</a>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </tr>
  );
}

HeaderBar.defaultProps = {
  title: 'React HN Benchmark',
};

module.exports = HeaderBar;
