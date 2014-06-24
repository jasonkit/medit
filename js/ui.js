var ui = {};

ui.edit_textarea = ikd.create_ui("edit-textarea", function ()
{
	var self = this;

	self.init = function ()
	{
		if (window.localStorage) {
			var text = window.localStorage["medit_text"];
			if (text !== undefined) {
				self.element.value = text;
			}

			var timer = function () {
				self.auto_save();
			}

			setInterval(timer, 5000);
		}	
	};

	self.auto_save = function ()
	{
		window.localStorage["medit_text"] = self.element.value;
	};

	// cb: reply the textarea value as agrument of the callback
	self.event_handler.on_get_textarea_value = function (msg)
	{
		msg.cb(self.element.value);
	};

	// value: new value to set to textarea
	self.event_handler.on_set_textarea_value = function (msg)
	{
		self.element.value = msg.value;
	};

	self.event_handler.on_switch_to_preview = function (msg)
	{
		self.element.parentNode.classList.add("hidden");
	};

	self.event_handler.on_switch_to_edit = function (msg)
	{
		self.element.parentNode.classList.remove("hidden");
	};

	self.event_handler.on_open_file_done = function (msg)
	{
		ikd.publish(ikd.app_event_channel, {
			msg_id: "make_backup",
			content: self.element.value,
		});

		self.element.value = msg.content;
	}
	
	self.event_handler.on_open_backup_done = function (msg)
	{
		self.element.value = msg.content;
	};
	
	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.preview_block = ikd.create_ui("preview-block", function ()
{
	var self = this;

	self.event_handler.on_switch_to_preview = function (msg)
	{
		var reply = function (content) {
			var article = document.createElement("article");
			article.innerHTML = blog.process_content(content);

			self.element.innerHTML = "";
			self.element.appendChild(article);

			blog.gist_post_process(article);
			blog.date_post_process(article);
		}

		var msg = {
			msg_id: "get_textarea_value",
			cb: reply,
		};

		ikd.publish(ikd.app_event_channel, msg);

		self.element.classList.remove("hidden");
	};


	self.event_handler.on_switch_to_edit = function (msg)
	{
		self.element.classList.add("hidden");
	};

	ikd.subscribe(self.event_handler, ikd.app_event_channel);

	// For displaying gist in preview mode
	document.write = function() {
		blog.gist_callback(arguments[0]);
	};	
});

ui.mode_button = ikd.create_ui("mode-button", function () 
{
	var self = this;
	
	self.bind_list = ["click"];
	self.mode = "edit";

	self.force_to_edit = function ()
	{
		if (self.mode === "preview") {
			self.switch_to_edit_mode();
		}
	};

	self.switch_to_preview_mode = function ()
	{
		ikd.publish(ikd.app_event_channel, "switch_to_preview");
		self.element.textContent = "Edit";
		self.active_click_cb = self.switch_to_edit_mode;
		self.mode = "preview";
	};
	
	self.switch_to_edit_mode = function ()
	{
		ikd.publish(ikd.app_event_channel, "switch_to_edit");
		self.element.textContent = "Preview";
		self.active_click_cb = self.switch_to_preview_mode;
		self.mode = "edit";
	};

	self.active_click_cb = self.switch_to_preview_mode;

	self.event_handler.on_click = function () {
		self.active_click_cb();
	}
	
	self.event_handler.on_open_file_done = self.force_to_edit;
	self.event_handler.on_open_back_done = self.force_to_edit;

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.login_button = ikd.create_ui("login-button", function()
{
	var self = this;

	self.bind_list = ["click"];

	self.event_handler.on_click = function ()
	{
		ikd.publish(ikd.app_event_channel, "dropbox_login");
	};

	self.event_handler.on_login_done = function ()
	{
		self.element.classList.add("hidden");
	};
	
	self.event_handler.on_logout_done = function ()
	{
		self.element.classList.remove("hidden");
	};

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.logout_button = ikd.create_ui("logout-button", function()
{
	var self = this;

	self.bind_list = ["click"];

	self.event_handler.on_click = function ()
	{
		ikd.publish(ikd.app_event_channel, "dropbox_logout");
	};
});

ui.db_menu = ikd.create_ui(["db-menu", "db-username"], function()
{
	var self = this;

	self.event_handler.on_login_done = function (msg)
	{
		self.element["db-menu"].classList.remove("hidden");
		self.element["db-username"].textContent = msg.username;
	};
	
	self.event_handler.on_logout_done = function (msg)
	{
		self.element["db-menu"].classList.add("hidden");
	};

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.db_file_datalist = ikd.create_ui("db-file-datalist", function ()
{
	var self = this;

	self.file_list = [];
	self.num_backup = 0;
	self.latest_backup_idx = 0;

	self.update_file_list = function ()
	{
		var i;

		self.element.innerHTML = "";

		for (i=0; i<self.file_list.length; i++) {
			self.element.innerHTML += "<option value=\""+self.file_list[i]+"\">"+self.file_list[i]+"</option>";
		}

		for (i=0; i<self.num_backup; i++) {
			if (self.latest_backup_idx === i) {
				self.element.innerHTML += "<option value=\"backup-"+i+"\">backup-"+i+" (Latest)</option>";
			}else{
				self.element.innerHTML += "<option value=\"backup-"+i+"\">backup-"+i+"</option>";
			}	
		}
	};

	// filelist: array of file from dropbox
	self.event_handler.on_update_file_list_by_dropbox = function (msg)
	{
		self.file_list = msg.file_list;
		self.update_file_list();
	};

	// num_backup: num of avaliable backup
	// latest_backup_idx: latest backup index
	self.event_handler.on_update_file_list_by_backup = function (msg)
	{
		self.num_backup = msg.num_backup;
		self.latest_backup_idx = msg.latest_backup_idx
		self.update_file_list();
	};

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.save_button = ikd.create_ui("save-button", function ()
{
	var self = this;

	self.bind_list = ["click"];

	self.event_handler.on_click = function ()
	{
		var reply = function (file) {
			if (file.match(/backup-[0-9]/) !== null) {
				ikd.publish(ikd.app_event_channel, {
					msg_id: "display_message",
					content: file + " is reversed for backup."
				});
			} else {

				var do_save = function (content) {
					ikd.publish(ikd.app_event_channel, {
						msg_id: "save_file",
						file: file,
						content: content,
					});
				};

				ikd.publish(ikd.app_event_channel, {
					msg_id: "get_textarea_value",
					cb: do_save,
				});
			}
		};
		
		ikd.publish(ikd.app_event_channel, {
			msg_id: "get_current_file_name",
			cb: reply,
		});
	};
});

ui.db_file_text = ikd.create_ui("db-file-text", function ()
{
	var self = this;

	self.bind_list = ["keyup"];
	
	self.event_handler.on_get_current_file_name = function (msg)
	{
		msg.cb(self.element.value);
	};

	self.event_handler.on_keyup = function (e)
	{
		if (e.keyCode !== 13) {
			return;
		}

		var file = self.element.value;
		var use_backup = false;

		if (file.trim() === "") {
			return;
		}

	
		if (file.match(/backup-[0-9]/) !== null) {
			var backup_idx = parseInt(file.substring(7));
			use_backup = true;
		}

		var cb = function (success) {
			if (success) {
		
				if (use_backup) {
					ikd.publish(ikd.app_event_channel, {
						msg_id: "open_backup",
						backup_idx: backup_idx,
					});
				} else {
					ikd.publish(ikd.app_event_channel, {
						msg_id: "open_file",
						file: file,
					});
				}

			}else{
				ikd.publish(ikd.app_event_channel, {
					msg_id: "display_message",
					content: file + " is not found.",
				});
			}
		}

		if (use_backup) {
			ikd.publish(ikd.app_event_channel, {
				msg_id: "check_backup_existence",
				backup_idx: backup_idx,
				cb: cb,
			});
		} else {
			ikd.publish(ikd.app_event_channel, {
				msg_id: "check_file_existence",
				file: file,
				cb: cb,
			});
		}

	};
	
	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

ui.message_block = ikd.create_ui("message-block", function ()
{
	var self = this;

	self.default_delay = 750;

	self.show_message = function (content, last_for) { 
		self.element.textContent = content;
		self.element.classList.remove("hidden");

		if (last_for !== undefined) {
			setTimeout(function(){
				self.element.classList.add("hidden");
			},last_for);
		}
	}

	self.hide = function ()
	{
		self.element.classList.add("hidden");
	}

	self.event_handler.on_display_message = function (msg)
	{
		self.show_message(msg.content, self.default_delay);
	};

	self.event_handler.on_open_file = function (msg) {
		self.show_message("Opening " + msg.file + " ...");
	};
	
	self.event_handler.on_open_backup = function (msg) {
		self.show_message("Opening Backup " + msg.backup_idx + " ...", self.default_delay);
	};
	
	self.event_handler.on_save_file = function (msg) {
		self.show_message("Saving " + msg.file + " ...");
	};
	
	self.event_handler.on_open_file_done = self.hide;
	self.event_handler.on_save_file_done = self.hide;

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
});

