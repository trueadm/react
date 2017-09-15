'use strict';

require('React');
require('PropTypes');

function timeAge(time) {
  var now = new Date().getTime() / 1000;
  var minutes = (now - time) / 60;

  if (minutes < 60) {
    return Math.round(minutes) + ' minutes ago';
  }
  return Math.round(minutes / 60) + ' hours ago';
}

function getHostUrl(url) {
  return (url + '').replace('https://', '').replace('http://', '').split('/')[
    0
  ];
}

function Story({story, rank}) {
  return [
    <tr className="athing">
      <td
        style={{
          verticalAlign: 'top',
          textAlign: 'right',
        }}
        className="title">
        <span className="rank">{rank}.</span>
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
        {story.url
          ? <span className="sitebit comhead">
              {' ('}<a href="#">{getHostUrl(story.url)}</a>)
            </span>
          : null}
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
        <a href="#">{`${story.descendants || 0} comments`}</a>
      </td>
    </tr>,
    <tr
      style={{
        height: 5,
      }}
      className="spacer"
    />,
  ];
}

function App(props) {
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
          {this.props.stories.length > 0
            ? [
                <tr
                  style={{
                    backgroundColor: '#222',
                  }}>
                  <table
                    style={{
                      padding: 4,
                    }}
                    width="100%"
                    cellSpacing="0"
                    cellPadding="0">
                    <tbody>
                      <tr>
                        <td
                          style={{
                            width: 18,
                            paddingRight: 4,
                          }}>
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
                        <td
                          style={{
                            lineHeight: '12pt',
                          }}
                          height="10">
                          <span className="pagetop">
                            <b className="hnname">{undefined}</b>
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
                </tr>,
                <tr height="10" />,
                <tr>
                  <td>
                    <table cellPadding="0" cellSpacing="0" className="itemlist">
                      <tbody>
                        {this.props.stories.map((story, i) => {
                          return (
                            <Story story={story} rank={++i} key={story.id} />
                          );
                        })}
                      </tbody>
                    </table>
                  </td>
                </tr>,
              ]
            : null}
        </tbody>
      </table>
    </center>
  );
}

var App_1 = App;

var compiledBundle = App_1;

module.exports = compiledBundle;
