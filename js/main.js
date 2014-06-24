function load ()
{
	var lib = ["http://cdnjs.cloudflare.com/ajax/libs/dropbox.js/0.9.2/dropbox.min.js",
			   "marked.js",
			   "blog.js",
			   "../../medit/js/ui.js"];

	ikd.app_event_channel = "medit";
	ikd.load_path = "../common/js/";
	ikd.load(lib, main);
}

var dropbox = {};

dropbox.setup = function ()
{
	var self = this;

	self.client = new Dropbox.Client({
		key: "cESClWiImzA=|G0Tm3CtDDkvdS5Wfq7ETLA6SwuJomaRK+z5HFuT9hg==",
		sandbox: true,
	});

	self.file_list = [];

	self.event_handler = {
		handle: ikd.default_handle,
	};

	self.show_error = function(error)
	{
		ikd.publish(ikd.app_event_channel, {
			msg_id: "display_message",
			content: error,
		});
	}

	self.update_file_list = function(cb)
	{
		self.client.readdir("/", function (error, entries) {
			if (error) {
				self.show_error(error);
				return;
			}
		
			self.file_list = entries;

			if ((cb !== undefined) && (typeof cb  === "function")) {
				cb();
			}

			ikd.publish(ikd.app_event_channel, {
				msg_id: "update_file_list_by_dropbox",
				file_list: entries,
			});
		});
	}

	self.event_handler.on_dropbox_login = function (msg)
	{
		self.client.authDriver(new Dropbox.Drivers.Redirect({rememberUser:true}));
		self.client.authenticate(function(error, client) {
			if (error) {
				self.show_error(error);
				return;
			}

			self.update_file_list(function() {
				self.client.getUserInfo(function(error, userInfo) {
					if (error) {
						self.show_error(error);
						return;
					}

					var msg = {
						msg_id: "login_done",
						username: userInfo.name,
					}
			
					ikd.publish(ikd.app_event_channel, msg);

					if (window.localStorage) {
						window.localStorage["medit_login"] = "true";
					}
 				});
			});
		});
	};

	self.event_handler.on_dropbox_logout = function (msg) 
	{
		self.client.signOut(function(error){
			if (error) {
				self.show_error(error);
				return;
			}
			
			ikd.publish(ikd.app_event_channel, "logout_done");
			
			if (window.localStorage) {
				window.localStorage["medit_login"] = "false";
			}
		});

	};

	// cb: reply with list of filename
	self.event_handler.on_get_file_list = function (msg)
	{
		msg.cb(self.file_list);
	};

	// file: name to check existence
	// cb: reply with result
	self.event_handler.on_check_file_existence = function (msg)
	{
		var i=0;
		var file_in_list = false;
		for (i=0; i<self.file_list.length; i++) {
			if (msg.file === self.file_list[i]) {
				file_in_list = true;
				break;
			}
		}

		msg.cb(file_in_list);
	};

	// file: file to open
	self.event_handler.on_open_file = function (msg)
	{
		self.client.readFile(msg.file, function (error, data) {
			if (error) {
				self.show_error(error);
				return;
			}

			ikd.publish(ikd.app_event_channel, {
				msg_id: "open_file_done",
				content: data,
			});
		});
	};

	// file: file to save
	self.event_handler.on_save_file = function (msg)
	{
		self.client.writeFile(msg.file, msg.content, function (error, stat){
			if (error) {
				self.show_error(error);
				return;
			}
			
			self.update_file_list();
			ikd.publish(ikd.app_event_channel, "save_file_done");
		});
	};

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
};

var backup = {};
backup.setup = function ()
{
	var self = this;

	self.max_backup = 10;

	self.event_handler = {
		handle: ikd.default_handle,
	};

	self.num_backup = parseInt(window.localStorage["medit_num_backup"]);

	if (isNaN(self.num_backup)) {
		self.num_backup = 0;
		self.next_backup_idx = 0;
	} else {
		self.next_backup_idx = parseInt(window.localStorage["medit_next_backup_idx"]);
	}

	// backup_idx: backup file idx to open
	self.event_handler.on_open_backup = function (msg)
	{
		ikd.publish(ikd.app_event_channel, {
			msg_id: "open_backup_done",
			content: window.localStorage["medit_backup-"+msg.backup_idx],	
		});
	};

	// content: content to backup
	self.event_handler.on_make_backup = function (msg)
	{
		window.localStorage["medit_backup-" + self.next_backup_idx] = msg.content;
		self.next_backup_idx = (self.next_backup_idx + 1) % self.max_backup;
		self.num_backup = (self.num_backup < 10)?(self.num_backup+1):10;

		window.localStorage["medit_num_backup"] = self.num_backup;
		window.localStorage["medit_next_backup_idx"] = self.next_backup_idx;

		ikd.publish(ikd.app_event_channel, {
			msg_id: "update_file_list_by_backup",
			num_backup: self.num_backup,
			latest_backup_idx: ((self.next_backup_idx + self.max_backup - 1) % self.max_backup),
		});

		ikd.publish(ikd.app_event_channel, "make_backup_done");
	};

	// backup_idx: backup index to check existence
	// cb: reply with result
	self.event_handler.on_check_backup_existence = function (msg)
	{
		if (msg.backup_idx < 0 || msg.backup_idx > self.num_backup) {
			msg.cb(false);
		}else{
			msg.cb(true);
		}
	};

	self.event_handler.on_login_done = function (msg)
	{
		ikd.publish(ikd.app_event_channel, {
			msg_id: "update_file_list_by_backup",
			num_backup: self.num_backup,
			latest_backup_idx: ((self.next_backup_idx + self.max_backup - 1) % self.max_backup),
		});	
	}

	ikd.subscribe(self.event_handler, ikd.app_event_channel);
};

function main ()
{
	dropbox.setup();

	if (window.localStorage) {
		backup.setup();

		if (window.localStorage["medit_login"] === "true") {
			ikd.publish(ikd.app_event_channel, "dropbox_login");
		}
	}
}

window.addEventListener("load", load);
