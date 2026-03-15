'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ui';
'require view';

var callAvailSpace = rpc.declare({
	object: 'luci.argon',
	method: 'avail'
});

var callRemoveArgon = rpc.declare({
	object: 'luci.argon',
	method: 'remove',
	params: ['filename'],
	expect: { '': {} }
});

var callRenameArgon = rpc.declare({
	object: 'luci.argon',
	method: 'rename',
	params: ['newname'],
	expect: { '': {} }
});

var bg_path = '/www/luci-static/argon/background/';
var trans_set = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

var liveColorVarMap = {
	primary: '--primary',
	dark_primary: '--dark-primary',
	header_color: '--header-color',
	menu_bg_color: '--menu-bg-color',
	menu_color: '--menu-color',
	main_menu_color: '--main-menu-color',
	red_color: '--red',
	orange_color: '--orange',
	yellow_color: '--yellow',
	green_color: '--green',
	teal_color: '--teal',
	cyan_color: '--cyan',
	gray_color: '--gray',
	gray_dark_color: '--gray-dark',
	lighter_color: '--lighter',
	success_color: '--success',
	info_color: '--info',
	warning_color: '--warning',
	danger_color: '--danger',
	dark_color: '--dark',
	default_color: '--default',
	background_color: '--background-color',
	white_color: '--white'
};

var colorGroups = [
	{
		id: 'accent',
		title: _('Accent'),
		description: _('Main Argon accent colors, including the stock purple source.'),
		options: [
			{ key: 'primary', title: _('[Light mode] Accent / Purple'), def: '#5e72e4', preview: 'accent' },
			{ key: 'dark_primary', title: _('[Dark mode] Accent / Purple'), def: '#483d8b', preview: 'accent' },
			{ key: 'default_color', title: _('Default / deep accent'), def: '#172b4d', preview: 'accent' },
			{ key: 'dark_color', title: _('Dark text / dark surface accent'), def: '#212529', preview: 'text' }
		]
	},
	{
		id: 'layout',
		title: _('Layout'),
		description: _('Page, menu, and header colors.'),
		options: [
			{ key: 'header_color', title: _('Header text'), def: '#ffffff', preview: 'text' },
			{ key: 'menu_bg_color', title: _('Menu background'), def: '#2b2b2b', preview: 'surface' },
			{ key: 'menu_color', title: _('Menu text'), def: '#cfd3dc', preview: 'text' },
			{ key: 'main_menu_color', title: _('Main menu text'), def: '#f5f7fa', preview: 'text' },
			{ key: 'background_color', title: _('Page background'), def: '#1f1f23', preview: 'surface' },
			{ key: 'white_color', title: _('Light surface / panel text contrast'), def: '#ffffff', preview: 'surface' },
			{ key: 'lighter_color', title: _('Border / muted surface'), def: '#4a4f59', preview: 'surface' }
		]
	},
	{
		id: 'semantic',
		title: _('Actions'),
		description: _('Refresh, hide, delete, warning, info, and success colors.'),
		options: [
			{ key: 'success_color', title: _('Success'), def: '#2dce89', preview: 'success' },
			{ key: 'info_color', title: _('Refresh / info'), def: '#11cdef', preview: 'info' },
			{ key: 'warning_color', title: _('Hide / warning'), def: '#fb6340', preview: 'warning' },
			{ key: 'danger_color', title: _('Delete / danger'), def: '#f5365c', preview: 'danger' }
		]
	},
	{
		id: 'palette',
		title: _('Palette'),
		description: _('Supporting palette colors used throughout the theme.'),
		options: [
			{ key: 'red_color', title: _('Red'), def: '#f5365c', preview: 'swatch' },
			{ key: 'orange_color', title: _('Orange'), def: '#fb6340', preview: 'swatch' },
			{ key: 'yellow_color', title: _('Yellow'), def: '#ffd600', preview: 'swatch' },
			{ key: 'green_color', title: _('Green'), def: '#2dce89', preview: 'swatch' },
			{ key: 'teal_color', title: _('Teal'), def: '#11cdef', preview: 'swatch' },
			{ key: 'cyan_color', title: _('Cyan'), def: '#2bffc6', preview: 'swatch' }
		]
	},
	{
		id: 'neutral',
		title: _('Neutral'),
		description: _('Neutral grays used for text and supporting UI.'),
		options: [
			{ key: 'gray_color', title: _('Gray'), def: '#8898aa', preview: 'text' },
			{ key: 'gray_dark_color', title: _('Gray dark'), def: '#32325d', preview: 'text' }
		]
	}
];

function isValidHexColor(value) {
	return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test((value || '').trim());
}

function invalidPreviewBackground() {
	return 'repeating-linear-gradient(45deg,#30343b,#30343b 4px,#3d424a 4px,#3d424a 8px)';
}

function getOptionValue(key, fallbackColor) {
	var v = uci.get('argon', '@global[0]', key);
	return isValidHexColor(v) ? v : fallbackColor;
}

function setLiveThemeVar(optionName, colorValue) {
	var cssVar = liveColorVarMap[optionName];

	if (!cssVar || !isValidHexColor(colorValue))
		return;

	document.documentElement.style.setProperty(cssVar, colorValue);
}

function applyInitialLiveThemeVars() {
	Object.keys(liveColorVarMap).forEach(function(optionName) {
		var value = uci.get('argon', '@global[0]', optionName);
		if (isValidHexColor(value))
			setLiveThemeVar(optionName, value);
	});
}

function injectCompactEditorStyles() {
	if (document.getElementById('argon-color-editor-styles'))
		return;

	var css = `
		.argon-colors-wrap {
			display: flex;
			flex-direction: column;
			gap: 12px;
			align-items: stretch;
		}

		.argon-colors-toolbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			flex-wrap: wrap;
			padding: 10px 12px;
			border: 1px solid rgba(255,255,255,0.08);
			border-radius: 10px;
			background: rgba(255,255,255,0.03);
			backdrop-filter: blur(4px);
		}

		.argon-colors-toolbar-note {
			font-size: 12px;
			color: #c7cfdb;
			line-height: 1.4;
		}

		.argon-color-group {
			border: 1px solid rgba(255,255,255,0.08);
			border-radius: 10px;
			background: rgba(255,255,255,0.02);
			overflow: hidden;
		}

		.argon-color-group summary {
			cursor: pointer;
			list-style: none;
			padding: 10px 12px;
			font-weight: 600;
			color: #f2f4f8;
			background: rgba(255,255,255,0.015);
			border-bottom: 1px solid rgba(255,255,255,0.05);
			user-select: none;
		}

		.argon-color-group summary::-webkit-details-marker {
			display: none;
		}

		.argon-color-group summary:before {
			content: "▸";
			display: inline-block;
			margin-right: 8px;
			color: #b8c0cc;
		}

		.argon-color-group[open] summary:before {
			content: "▾";
		}

		.argon-color-group-body {
			padding: 10px 12px 12px 12px;
		}

		.argon-color-group-desc {
			font-size: 12px;
			color: #aeb8c7;
			margin-bottom: 10px;
			line-height: 1.4;
		}

		.argon-color-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 10px;
			align-items: start;
			justify-items: stretch;
		}

		.argon-color-card {
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 10px;
			border: 1px solid rgba(255,255,255,0.08);
			border-radius: 10px;
			background: rgba(20,23,28,0.92);
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
			min-width: 0;
			width: 100%;
		}

		.argon-color-card-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
		}

		.argon-color-card-title {
			font-size: 12px;
			font-weight: 600;
			color: #eef2f7;
			line-height: 1.3;
			text-align: left;
			flex: 1 1 auto;
			min-width: 0;
			word-break: break-word;
		}

		.argon-color-card-controls {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 6px;
			flex-wrap: nowrap;
		}

		.argon-color-hex {
			flex: 1 1 auto;
			min-width: 0;
			height: 32px;
			padding: 6px 8px;
			border-radius: 7px;
			border: 1px solid rgba(255,255,255,0.14);
			background: rgba(255,255,255,0.04);
			color: #f5f7fa;
			outline: none;
			text-align: left;
		}

		.argon-color-hex::placeholder {
			color: #9aa6b2;
		}

		.argon-color-hex:focus {
			border-color: var(--primary, #5e72e4);
			box-shadow: 0 0 0 1px var(--primary, #5e72e4);
		}

		.argon-color-picker {
			width: 36px;
			height: 32px;
			padding: 0;
			border-radius: 7px;
			border: 1px solid rgba(255,255,255,0.14);
			background: rgba(255,255,255,0.04);
			cursor: pointer;
			flex: 0 0 36px;
		}

		.argon-color-swatch {
			display: inline-block;
			width: 18px;
			height: 18px;
			border-radius: 4px;
			border: 1px solid rgba(255,255,255,0.18);
			flex: 0 0 18px;
		}

		.argon-color-preview-row {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			gap: 4px;
			flex-wrap: wrap;
			min-height: 24px;
			text-align: left;
		}

		.argon-chip-fill,
		.argon-chip-outline {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 52px;
			height: 22px;
			padding: 0 8px;
			border-radius: 999px;
			font-size: 11px;
			font-weight: 600;
			line-height: 1;
			box-sizing: border-box;
		}

		.argon-chip-fill {
			color: #fff;
			border: 1px solid rgba(255,255,255,0.08);
		}

		.argon-chip-outline {
			background: transparent;
		}

		.argon-text-sample {
			font-size: 12px;
			font-weight: 600;
			line-height: 1.2;
		}

		.argon-surface-sample {
			display: inline-block;
			width: 88px;
			height: 22px;
			border-radius: 6px;
			border: 1px solid rgba(255,255,255,0.12);
		}

		@media (max-width: 900px) {
			.argon-color-grid {
				grid-template-columns: 1fr;
			}
		}

		@media (max-width: 600px) {
			.argon-colors-toolbar {
				align-items: stretch;
			}

			.argon-colors-toolbar .cbi-button {
				width: 100%;
			}

			.argon-color-card {
				padding: 9px;
			}

			.argon-color-card-controls {
				gap: 5px;
			}

			.argon-color-hex {
				font-size: 14px;
			}
		}
	`;

	var style = document.createElement('style');
	style.id = 'argon-color-editor-styles';
	style.textContent = css;
	document.head.appendChild(style);
}

function buildChip(label, colorValue, filled) {
	return E('span', {
		'class': filled ? 'argon-chip-fill' : 'argon-chip-outline',
		'style': filled
			? 'background:' + colorValue + ';'
			: 'color:' + colorValue + ';border:2px solid ' + colorValue + ';'
	}, label);
}

function buildTextSample(text, colorValue) {
	return E('span', {
		'class': 'argon-text-sample',
		'style': 'color:' + colorValue + ';'
	}, text);
}

function buildSurfaceSample(colorValue) {
	return E('span', {
		'class': 'argon-surface-sample',
		'style': 'background:' + colorValue + ';'
	});
}

function refillPreviewRow(previewRow, previewKind, colorValue, valid) {
	while (previewRow.firstChild)
		previewRow.removeChild(previewRow.firstChild);

	if (!valid) {
		previewRow.appendChild(E('span', {
			'style': 'font-size:11px;color:#ff8f8f;'
		}, _('Invalid HEX')));
		return;
	}

	switch (previewKind) {
	case 'accent':
		previewRow.appendChild(buildTextSample(_('Link'), colorValue));
		previewRow.appendChild(buildChip(_('Button'), colorValue, true));
		previewRow.appendChild(buildChip(_('Focus'), colorValue, false));
		break;

	case 'text':
		previewRow.appendChild(buildTextSample(_('Aa'), colorValue));
		previewRow.appendChild(buildTextSample(_('Menu'), colorValue));
		break;

	case 'surface':
		previewRow.appendChild(buildSurfaceSample(colorValue));
		break;

	case 'success':
		previewRow.appendChild(buildChip(_('OK'), colorValue, true));
		previewRow.appendChild(buildChip(_('Done'), colorValue, false));
		break;

	case 'info':
		previewRow.appendChild(buildChip(_('Refresh'), colorValue, true));
		previewRow.appendChild(buildChip(_('Info'), colorValue, false));
		break;

	case 'warning':
		previewRow.appendChild(buildChip(_('Hide'), colorValue, true));
		previewRow.appendChild(buildChip(_('Warn'), colorValue, false));
		break;

	case 'danger':
		previewRow.appendChild(buildChip(_('Delete'), colorValue, true));
		previewRow.appendChild(buildChip(_('Danger'), colorValue, false));
		break;

	default:
		previewRow.appendChild(buildSurfaceSample(colorValue));
		break;
	}
}

function makeCompactColorEditor(opt) {
	var color = getOptionValue(opt.key, opt.def);

	var swatch = E('span', {
		'class': 'argon-color-swatch',
		'style': 'background:' + (isValidHexColor(color) ? color : invalidPreviewBackground()) + ';'
	});

	var title = E('div', {
		'class': 'argon-color-card-title'
	}, opt.title);

	var textInput = E('input', {
		'type': 'text',
		'value': color,
		'placeholder': '#000000',
		'class': 'argon-color-hex'
	});

	var picker = E('input', {
		'type': 'color',
		'value': isValidHexColor(color) ? color : opt.def,
		'title': _('Pick color'),
		'class': 'argon-color-picker'
	});

	var previewRow = E('div', {
		'class': 'argon-color-preview-row'
	});

	function applyValue(value) {
		value = (value || '').trim();
		var valid = isValidHexColor(value);

		if (valid) {
			swatch.style.background = value;
			swatch.title = value;
			picker.value = value;
			setLiveThemeVar(opt.key, value);
			uci.set('argon', '@global[0]', opt.key, value);
		} else {
			swatch.style.background = invalidPreviewBackground();
			swatch.title = _('Invalid HEX color');
		}

		refillPreviewRow(previewRow, opt.preview, value, valid);
	}

	textInput.addEventListener('input', function() {
		applyValue(textInput.value);
	});

	textInput.addEventListener('change', function() {
		applyValue(textInput.value);
	});

	picker.addEventListener('input', function() {
		textInput.value = picker.value;
		applyValue(picker.value);
	});

	applyValue(color);

	return E('div', {
		'class': 'argon-color-card'
	}, [
		E('div', {
			'class': 'argon-color-card-head'
		}, [
			title,
			swatch
		]),
		E('div', {
			'class': 'argon-color-card-controls'
		}, [
			textInput,
			picker
		]),
		previewRow
	]);
}

function makeColorGroup(group) {
	return E('details', {
		'class': 'argon-color-group',
		'open': group.id === 'accent' || group.id === 'layout'
	}, [
		E('summary', {}, group.title),
		E('div', {
			'class': 'argon-color-group-body'
		}, [
			E('div', {
				'class': 'argon-color-group-desc'
			}, group.description),
			E('div', {
				'class': 'argon-color-grid'
			}, group.options.map(makeCompactColorEditor))
		])
	]);
}

function buildColorsPanel(map) {
	var panel = E('div', {
		'class': 'argon-colors-wrap'
	});

	var saveTopBtn = E('button', {
		'class': 'cbi-button cbi-button-apply'
	}, _('Save settings'));

	saveTopBtn.addEventListener('click', function(ev) {
		ev.preventDefault();
		map.save(null, true).then(function() {
			ui.changes.apply(true);
		});
	});

	panel.appendChild(E('div', {
		'class': 'argon-colors-toolbar'
	}, [
		E('div', {
			'class': 'argon-colors-toolbar-note'
		}, _('Live preview updates this page immediately while you edit. The layout is compact, dark, and mobile-friendly.')),
		saveTopBtn
	]));

	colorGroups.forEach(function(group) {
		panel.appendChild(makeColorGroup(group));
	});

	return panel;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('argon'),
			L.resolveDefault(callAvailSpace(), {}),
			L.resolveDefault(fs.list(bg_path), {})
		]);
	},

	render: function(data) {
		var m, s, o;

		injectCompactEditorStyles();

		m = new form.Map(
			'argon',
			_('Argon theme configuration'),
			_('Here you can set the blur and transparency of the login page of argon theme, manage background pictures and videos, and compactly customize all exposed theme colors in real time.')
		);

		s = m.section(form.TypedSection, 'global', _('Theme configuration'));
		s.addremove = false;
		s.anonymous = true;
		s.tab('general', _('General'));
		s.tab('colors', _('Colors'));

		o = s.taboption('general', form.ListValue, 'online_wallpaper', _('Wallpaper source'));
		o.value('none', _('Built-in'));
		o.value('bing', _('Bing'));
		o.value('unsplash', _('Unsplash'));
		o.value('wallhaven', _('Wallhaven'));
		o.default = 'bing';
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'mode', _('Theme mode'));
		o.value('normal', _('Follow system'));
		o.value('light', _('Light mode'));
		o.value('dark', _('Dark mode'));
		o.default = 'normal';
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'transparency', _('[Light mode] Transparency'), _('0 transparent - 1 opaque.'));
		for (var i of trans_set)
			o.value(i);
		o.default = '0.5';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'blur', _('[Light mode] Frosted Glass Radius'), _('Larger value will be more blurred.'));
		o.datatype = 'ufloat';
		o.default = '10';
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'transparency_dark', _('[Dark mode] Transparency'), _('0 transparent - 1 opaque.'));
		for (var j of trans_set)
			o.value(j);
		o.default = '0.5';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'blur_dark', _('[Dark mode] Frosted Glass Radius'), _('Larger value will be more blurred.'));
		o.datatype = 'ufloat';
		o.default = '10';
		o.rmempty = false;

		o = s.taboption('colors', form.DummyValue, '_colors_compact', _('Compact live color editor'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '';
		};
		o.renderWidget = function() {
			return buildColorsPanel(m);
		};

		o = s.taboption('colors', form.Button, '_save_colors_bottom', _('Save settings'));
		o.inputstyle = 'apply';
		o.inputtitle = _('Save current settings');
		o.onclick = function() {
			return this.map.save(null, true).then(function() {
				ui.changes.apply(true);
			});
		};

		s = m.section(
			form.TypedSection,
			null,
			_('Upload background (available space: %1024.2mB)').format(data[1].avail * 1024),
			_('You can upload files such as gif/jpg/mp4/png/webm/webp files, to change the login page background.')
		);
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Button, '_upload_bg', _('Upload background'), _('Files will be uploaded to `%s`.').format(bg_path));
		o.inputstyle = 'action';
		o.inputtitle = _('Upload...');
		o.onclick = function(ev) {
			var file = '/tmp/argon_background.tmp';

			return ui.uploadFile(file, ev.target).then(function(res) {
				return L.resolveDefault(callRenameArgon(res.name), {}).then(function(ret) {
					if (ret.result === 0)
						return location.reload();
					else {
						ui.addNotification(null, E('p', _('Failed to upload file: %s.').format(res.name)));
						return L.resolveDefault(fs.remove(file), {});
					}
				});
			}).catch(function(e) {
				ui.addNotification(null, E('p', e.message));
			});
		};
		o.modalonly = true;

		s = m.section(form.TableSection);
		s.render = function() {
			var tbl = E('table', { 'class': 'table cbi-section-table' },
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, [ _('Filename') ]),
					E('th', { 'class': 'th' }, [ _('Modified date') ]),
					E('th', { 'class': 'th' }, [ _('Size') ]),
					E('th', { 'class': 'th' }, [ _('Action') ])
				])
			);

			cbi_update_table(tbl, data[2].map(L.bind(function(file) {
				return [
					file.name,
					new Date(file.mtime * 1000).toLocaleString(),
					String.format('%1024.2mB', file.size),
					E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': ui.createHandlerFn(this, function() {
							return L.resolveDefault(callRemoveArgon(file.name), {}).then(function() {
								return location.reload();
							});
						})
					}, [ _('Delete') ])
				];
			}, this)), E('em', _('No files found.')));

			return E('div', { 'class': 'cbi-map', 'id': 'cbi-filelist' }, [
				E('h3', _('Background file list')),
				tbl
			]);
		};

		var rendered = m.render();

		window.setTimeout(function() {
			applyInitialLiveThemeVars();
		}, 0);

		return rendered;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
