listen event_channel;
notify event_channel , 'This is the payload';

create or replace function event_trigger() returns trigger 
as $event_trigger$
	begin 
		PERFORM pg_notify('event_channel' ,'{"event_id":' || new.event_id || ', "device_id": ' || new.device_id || ', "object_id": ' || new.object_id || ', "event_time": ' || new.event_time || ' }');
		RETURN NULL;
	end;
$event_trigger$ language plpgsql;

drop trigger event_trigger on "event";

create trigger event_trigger
after insert on "event"
for each row execute procedure event_trigger();

event_id: number;
    device_id: number;
    object_id: number;
    object_group_id: number;
    event_time: Date;
    event_type: number;
    event_subtype: number;
    source_type: number;
    source_id: number;
    channel_id: number;
    object_state: number;
    object_state_change: number;
    message_id: number;
    device_number: number;
    partition_number: number;
    object_number: number;
    sensor_number: number;
    pin_number: number;
    key_number: number;
    info: string;
    event_data_size: number;
    event_data?: Buffer;
    server_id: number;
    device_addr: number;
    event_create_time: Date;
    channel_net: number;
    shift_id: number;