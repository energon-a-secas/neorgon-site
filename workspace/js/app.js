/**
 * Neorgon Workspace page (neorgon.com/workspace/): entry point.
 * Contract: docs/plans/2026-11-03-neorgon-workspace.md in the monorepo.
 */
import { state, load, refreshPrefs } from './store.js'
import { renderEditor, fillZones } from './editor.js'
import { route, banner } from './flow.js'
import { wire } from './events.js'
import { plural } from './util.js'

load()
refreshPrefs()
fillZones()
wire()
renderEditor()
if (!state.canStore) banner('This browser is not keeping anything for this page (private browsing, or site data is blocked). You can look, but nothing you change will stay.')
else if (state.issues.length) banner(`The stored workspace had ${plural(state.issues.length, 'problem')}; what could be read is shown.`)
route(renderEditor)
