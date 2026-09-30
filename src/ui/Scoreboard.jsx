import { game } from '../game/state'
import { W } from '../game/weapons'

function Team({ team }) {
  const list = game.agents.filter(a => a.team === team).sort((a, b) => b.score - a.score || b.kills - a.kills)
  const me = game.local
  return (
    <div className={`sb-team ${team.toLowerCase()}`}>
      <div className="sb-title">
        <b>{team === 'CT' ? 'COUNTER-TERRORISTS' : 'TERRORISTS'}</b>
        <span className="sb-score">{game.score[team]}</span>
      </div>
      <table>
        <thead><tr><th>Người chơi</th><th>$</th><th>K</th><th>A</th><th>D</th><th>HS%</th><th>★</th><th>Điểm</th></tr></thead>
        <tbody>
          {list.map(a => (
            <tr key={a.id} className={`${a.alive ? '' : 'dead'} ${a === me ? 'me' : ''}`}>
              <td>
                {a.isBot ? <span className="bot">BOT</span> : null}{a.name}
                {a.inv[5]?.id === 'c4' && (me.team === 'T') ? ' 💣' : ''}
                {a.defuser ? ' ✂' : ''}
                <em>{a.alive && a.team === me.team && a.inv[1] ? W[a.inv[1].id].name : ''}</em>
              </td>
              <td>{a.team === me.team ? `$${a.money}` : ''}</td>
              <td>{a.kills}</td><td>{a.assists}</td><td>{a.deaths}</td>
              <td>{a.kills ? Math.round((a.hs / a.kills) * 100) : 0}</td>
              <td>{a.mvps || ''}</td>
              <td>{a.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Scoreboard() {
  const first = game.local.team === 'CT' ? 'CT' : 'T'
  return (
    <div className="scoreboard">
      <div className="sb-head">de_dust2 · Competitive · Round {game.round}/{game.maxRounds}</div>
      <Team team={first} />
      <div className="sb-history">
        {game.history.map((h, i) => (
          <i key={i} className={h.winner.toLowerCase()} title={h.reason}>
            {h.reason === 'bomb' ? '💥' : h.reason === 'defuse' ? '✂' : h.reason === 'time' ? '⏱' : '☠'}
          </i>
        ))}
      </div>
      <Team team={first === 'CT' ? 'T' : 'CT'} />
    </div>
  )
}
