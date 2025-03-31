
with 
{{#chains}}
{{name}}_move_ticks as (
    select '{{name}}' as chain, tvl.* 
    from {{name}}.clm_strategy_tvl_event tvl
    left join {{name}}.clm_deposit_event deposit on tvl.created_with = deposit.created_with
    left join {{name}}.clm_withdraw_event withdraw on tvl.created_with = withdraw.created_with
    where deposit.id is null and withdraw.id is null
),
{{/chains}}
move_ticks as (
    {{#chains}}
    select * from {{name}}_move_ticks
    {{^last}}
    union all
    {{/last}}
    {{/chains}}
)
select * from move_ticks


