package com.example.veriproof.infra.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Redis 설정.
 * 응시 활성 lock(SET NX EX), 답안 초안(HSET) 등 단순 String/Hash 연산만 사용하므로
 * StringRedisTemplate 한 개만 노출한다. 값에 객체 직렬화가 필요하면 호출 측에서 JSON 직렬화 후 String으로 저장한다.
 */
@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }
}
